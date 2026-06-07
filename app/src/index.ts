import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import express, { Request, Response } from "express";
import axios from "axios";
import { google } from "googleapis";
import mongoose, { Schema, Document } from "mongoose";
import { getWaitlist } from "./db/client";
import { rankWaitlist } from "./ranking";

mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => console.log("[mongodb] connected"))
  .catch((err) => console.error("[mongodb] connection error:", err));

const callSchema = new Schema(
  {
    callType: {
      type: String,
      enum: ["inbound_cancellation", "outbound_confirmation"],
    },
  },
  { strict: false, timestamps: true },
);
const Call = mongoose.model("Call", callSchema, "calls");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const FONIO_API_KEY = process.env.FONIO_API_KEY!;
const FONIO_FROM_NUMBER = "+4369919210575";
const OUTBOUND_CALL_URL = "https://app.fonio.ai/api/public/v1/outbound_call";

const MAX_BOOKINGS = 2;
const CASCADE_WINDOW_DAYS = 7;
const MAX_CALLBACKS = 3;

// Idempotency guard for the outbound-call-done webhook (best-effort callId dedupe).
const processedCalls = new Set<string>();

const auth = new google.auth.GoogleAuth({
  keyFile:
    process.env.GOOGLE_CALENDAR_KEY_FILE ??
    path.resolve(__dirname, "../../.alfred.iam.json"),
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
});
const calendar = google.calendar({ version: "v3", auth });

app.use(express.json());

interface WaitlistPerson {
  waitlistId: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  appointmentDateTime: string; // DD.MM.YYYY HH:MM
  appointmentType: string;
}

interface AppointmentDetails {
  appointmentStart: string; // DD.MM.YYYY HH:MM
  appointmentType: string;
  durationMin: number;
}

interface AppointmentBody {
  extractionData?: {
    didCancel?: boolean | null;
  };
}

interface OutboundCallBody {
  callId?: string;
  id?: string;
  _id?: string;
  extractionData?: {
    didSchedule?: boolean | null;
    requestedCallbackInMinutes?: number | null;
  };
  context?: Record<string, any>;
}

// ---- Date / slot helpers ----

/** Manual parse of the "DD.MM.YYYY HH:MM" format used everywhere in this file. */
function parseAppointmentDateTime(s: string): Date | null {
  if (!s || typeof s !== "string") return null;

  const match = s
    .trim()
    .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;

  const [, dayStr, monthStr, yearStr, hourStr, minuteStr] = match;
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;

  // Guard against JS `Date` rollover for invalid components (e.g. 31.02.2026).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
}

/** Stable id for a freed/offered slot — just the normalized start string. */
function slotIdFromStart(appointmentStart: string): string {
  return appointmentStart;
}

/** True iff `slotStart` is strictly in the future and within `CASCADE_WINDOW_DAYS` days. */
function isWithinCascadeWindow(
  slotStart: Date,
  now: Date = new Date(),
): boolean {
  const windowEnd = new Date(
    now.getTime() + CASCADE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  return slotStart > now && slotStart <= windowEnd;
}

async function getRecentlyCancelledCalendarEvent(): Promise<AppointmentDetails | null> {
  const updatedMin = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const res = await calendar.events.list({
    calendarId: "scheer28philipp@gmail.com",
    showDeleted: true,
    updatedMin,
    singleEvents: true,
  });

  const allItems = res.data.items ?? [];
  console.log("[calendar] events updated in last 15 min:", allItems.length);

  const cancelled = allItems
    .filter((e) => e.status === "cancelled")
    .sort(
      (a, b) => new Date(b.updated!).getTime() - new Date(a.updated!).getTime(),
    );

  if (cancelled.length === 0) {
    console.warn("[calendar] no recently cancelled event found");
    console.log(
      "[calendar] all statuses found:",
      allItems.map((e) => `${e.summary} → ${e.status}`),
    );
    return null;
  }

  const event = cancelled[0];
  console.log("[calendar] raw cancelled event:");
  console.log(JSON.stringify(event, null, 2));

  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date;

  if (!startRaw || !endRaw) {
    console.error(
      "[calendar] cancelled event is missing start/end — Google may not return full data for deleted events",
    );
    return null;
  }

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  const pad = (n: number) => String(n).padStart(2, "0");
  const appointmentStart = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}.${start.getFullYear()} ${pad(start.getHours())}:${pad(start.getMinutes())}`;

  console.log("[calendar] parsed slot:", {
    appointmentStart,
    appointmentType: event.summary,
    durationMin,
  });

  return {
    appointmentStart,
    appointmentType: event.summary ?? "Dental appointment",
    durationMin,
  };
}

const INELIGIBLE_WAITLIST_STATUSES = new Set([
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
]);

async function pickNextPersonForSlot(
  slotId: string,
): Promise<WaitlistPerson | null> {
  const patients = await (await getWaitlist()).find({}).toArray();
  const ranked = rankWaitlist(patients);

  const top = ranked.find(
    (candidate) =>
      candidate.hardFilterPassed === true &&
      !INELIGIBLE_WAITLIST_STATUSES.has(candidate.waitlist_status) &&
      !candidate.already_rejected_slots?.includes(slotId),
  );

  if (!top) {
    console.warn(`[waitlist] no eligible candidate for slot ${slotId}`);
    return null;
  }

  const nameParts = top.name.trim().split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  console.log(
    `[waitlist] picked ${firstName} ${lastName} (rank #${top.rank}, finalScore ${top.finalScore.toFixed(4)})`,
  );

  return {
    waitlistId: top.waitlist_id,
    phone: "+4367761244487", // override the Phone Number from the mock phone numbers in the list
    firstName,
    lastName,
    // override the email with my personal
    email: "scheer28philipp@gmail.com",
    appointmentType: top.desired_treatment,
    // The waitlist schema has no stored appointment datetime for the patient's
    // existing/old slot — the dataset doesn't carry it, so leave blank.
    // appointmentDateTime: "18.06.2025 10:00",
    appointmentDateTime: "10.06.2026 11:00",
  };
}

async function callPersonAndScheduleBlock(
  person: WaitlistPerson,
  newSlot: AppointmentDetails,
  slotId: string,
  bookingNumber: number,
  callbackCount: number = 0,
): Promise<void> {
  const [oldDate, oldTime] = person.appointmentDateTime.split(" ");
  const [newDate, newTime] = newSlot.appointmentStart.split(" ");

  const payload = {
    apiKey: FONIO_API_KEY,
    fromNumber: FONIO_FROM_NUMBER,
    toNumber: person.phone,
    context: {
      first_name: person.firstName,
      last_name: person.lastName,
      phone: person.phone,
      email: person.email,
      appointment_old_date: oldDate,
      appointment_old_time: oldTime,
      appointment_old_type: person.appointmentType,
      appointment_new_date: newDate,
      appointment_new_time: newTime,
      appointment_new_type: newSlot.appointmentType,
      waitlist_id: person.waitlistId,
      slot_id: slotId,
      booking_number: bookingNumber,
      callback_count: callbackCount,
    },
  };

  console.log(
    "[outbound] calling",
    person.firstName,
    person.lastName,
    person.phone,
  );
  console.log(
    "[outbound] old slot:",
    person.appointmentDateTime,
    person.appointmentType,
  );
  console.log(
    "[outbound] new slot:",
    newSlot.appointmentStart,
    newSlot.appointmentType,
  );
  const response = await axios.post(OUTBOUND_CALL_URL, payload);
  console.log("[outbound] call initiated:", response.data);
}

/**
 * Hold the offered slot for the same patient and re-call them after `minutes`.
 * NOTE: in-memory scheduling — a process restart loses any pending callbacks.
 */
function scheduleCallback(
  ctx: Record<string, any>,
  minutes: number,
  bookingNumber: number,
): void {
  const callbackCount = Number(ctx?.callback_count ?? 0);

  if (callbackCount >= MAX_CALLBACKS) {
    console.log(
      `[callback] max callbacks (${MAX_CALLBACKS}) reached for ${ctx?.waitlist_id} — not scheduling another`,
    );
    return;
  }

  const person: WaitlistPerson = {
    waitlistId: ctx.waitlist_id,
    phone: ctx.phone,
    firstName: ctx.first_name,
    lastName: ctx.last_name,
    email: ctx.email,
    appointmentDateTime: `${ctx.appointment_old_date} ${ctx.appointment_old_time}`,
    appointmentType: ctx.appointment_old_type,
  };

  const offeredSlot: AppointmentDetails = {
    appointmentStart: `${ctx.appointment_new_date} ${ctx.appointment_new_time}`,
    appointmentType: ctx.appointment_new_type,
    durationMin: 30,
  };

  const slotId = ctx.slot_id;

  console.log(
    `[callback] scheduling callback to ${person.firstName} ${person.lastName} in ${minutes} min for slot ${slotId} (callback ${callbackCount + 1}/${MAX_CALLBACKS})`,
  );

  setTimeout(
    () => {
      callPersonAndScheduleBlock(
        person,
        offeredSlot,
        slotId,
        bookingNumber,
        callbackCount + 1,
      ).catch(console.error);
    },
    minutes * 60 * 1000,
  );
}

// ---- DB update helpers ----

async function markAccepted(waitlistId: string): Promise<void> {
  try {
    await (
      await getWaitlist()
    ).updateOne(
      { waitlist_id: waitlistId },
      { $set: { waitlist_status: "ACCEPTED", updatedAt: new Date() } },
    );
  } catch (err) {
    console.error(`[mongodb] failed to mark ${waitlistId} as ACCEPTED:`, err);
  }
}

async function markRejectedForSlot(
  waitlistId: string,
  slotId: string,
): Promise<void> {
  try {
    await (
      await getWaitlist()
    ).updateOne(
      { waitlist_id: waitlistId },
      {
        $addToSet: { already_rejected_slots: slotId },
        $set: { updatedAt: new Date() },
      },
    );
  } catch (err) {
    console.error(
      `[mongodb] failed to record rejection of slot ${slotId} for ${waitlistId}:`,
      err,
    );
  }
}

// ---- Single entry point for filling a freed/offered slot ----

async function fillSlot(
  slot: AppointmentDetails,
  bookingNumber: number,
): Promise<void> {
  const slotId = slotIdFromStart(slot.appointmentStart);
  const person = await pickNextPersonForSlot(slotId);

  if (!person) {
    console.warn(
      `[recovery] no eligible candidate for slot ${slotId} — leaving open (NEEDS_HUMAN)`,
    );
    return;
  }

  console.log(
    `[recovery] filling slot ${slotId} (booking #${bookingNumber}) — offering to`,
    person.firstName,
    person.lastName,
    "—",
    person.appointmentDateTime,
    person.appointmentType,
  );

  await callPersonAndScheduleBlock(person, slot, slotId, bookingNumber);
}

async function handleCancelledAppointment(): Promise<void> {
  const appointment = await getRecentlyCancelledCalendarEvent();

  if (!appointment) {
    console.error(
      "[handler] could not find cancelled calendar event — aborting",
    );
    return;
  }

  console.log("[slot] freed up:", appointment);

  await fillSlot(appointment, 1);
}

// ---- Done-handler: the heart of both recovery loops ----

async function handleOutboundCallDone(body: OutboundCallBody): Promise<void> {
  const callId = body?.callId ?? body?.id ?? body?._id;

  if (callId) {
    if (processedCalls.has(callId)) {
      console.log(`[recovery] duplicate webhook for ${callId} — ignoring`);
      return;
    }
    processedCalls.add(callId);
  }

  const ctx = body?.context ?? {};
  const waitlistId = ctx?.waitlist_id;
  const slotId = ctx?.slot_id;
  const bookingNumber = Number(ctx?.booking_number ?? 1);
  const didSchedule = body?.extractionData?.didSchedule;

  if (!slotId || !waitlistId) {
    console.log(
      "[recovery] outbound-call-done missing slot_id/waitlist_id in context — not a managed call, ignoring",
    );
    return;
  }

  if (didSchedule !== true) {
    const requestedCallbackInMinutes =
      body?.extractionData?.requestedCallbackInMinutes;
    if (
      requestedCallbackInMinutes != null &&
      Number(requestedCallbackInMinutes) > 0
    ) {
      console.log(
        `[callback] ${ctx?.first_name ?? ""} ${ctx?.last_name ?? ""} requested a callback in ${requestedCallbackInMinutes} min for slot ${slotId} — holding slot, not offering to next candidate`,
      );
      scheduleCallback(ctx, Number(requestedCallbackInMinutes), bookingNumber);
      return;
    }

    // Loop 1: retry — the offered candidate declined (or no-show).
    await markRejectedForSlot(waitlistId, slotId);

    const offeredSlot: AppointmentDetails = {
      appointmentStart: `${ctx?.appointment_new_date} ${ctx?.appointment_new_time}`,
      appointmentType: ctx?.appointment_new_type,
      durationMin: 30, // not used for the call
    };

    console.log(
      `[retry] ${ctx?.first_name ?? ""} ${ctx?.last_name ?? ""} declined slot ${slotId} — offering to next candidate`,
    );

    await fillSlot(offeredSlot, bookingNumber);
    return;
  }

  // Loop 2: cascade — the offered candidate accepted.
  await markAccepted(waitlistId);

  console.log(
    `[cascade] booking ${bookingNumber} filled: ${ctx?.first_name ?? ""} ${ctx?.last_name ?? ""} took slot ${slotId}`,
  );

  if (bookingNumber >= MAX_BOOKINGS) {
    console.log(`[cascade] reached max bookings (${MAX_BOOKINGS}) — stopping`);
    return;
  }

  const freedStartStr = `${ctx?.appointment_old_date} ${ctx?.appointment_old_time}`;
  const freedStart = parseAppointmentDateTime(freedStartStr);

  if (!freedStart) {
    console.error("[cascade] freed slot datetime unparseable — stopping");
    return;
  }

  if (!isWithinCascadeWindow(freedStart)) {
    console.log(
      `[cascade] freed slot ${freedStartStr} is past or >7 days out — leaving open`,
    );
    return;
  }

  const freedSlotDetails: AppointmentDetails = {
    appointmentStart: freedStartStr,
    appointmentType: ctx?.appointment_old_type,
    durationMin: 30,
  };

  console.log(
    `[cascade] freed slot ${freedStartStr} within window — filling as booking ${bookingNumber + 1}`,
  );

  await fillSlot(freedSlotDetails, bookingNumber + 1);
}

app.post("/webhook/cancelled-appointment", (req: Request, res: Response) => {
  console.log("[webhook] cancelled-appointment received:");
  console.log(JSON.stringify(req.body, null, 2));

  new Call({ ...req.body, callType: "inbound_cancellation" })
    .save()
    .catch((err) => console.error("[mongodb] save error:", err));

  if (req.body?.extractionData?.didCancel === true) {
    res.status(200).json({ received: true });
    handleCancelledAppointment().catch(console.error);
    return;
  }

  res.status(200).json({ received: true });
});

app.post("/webhook/outbound-call-done", (req: Request, res: Response) => {
  console.log("[webhook] outbound-call-done received:");
  console.log(JSON.stringify(req.body, null, 2));

  new Call({ ...req.body, callType: "outbound_confirmation" })
    .save()
    .catch((err) => console.error("[mongodb] save error:", err));

  res.status(200).json({ received: true });
  handleOutboundCallDone(req.body).catch(console.error);
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
