import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import express, { Request, Response } from "express";
import axios from "axios";
import { google } from "googleapis";
import mongoose, { Schema, Document } from "mongoose";

mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => console.log("[mongodb] connected"))
  .catch((err) => console.error("[mongodb] connection error:", err));

const callSchema = new Schema(
  { callType: { type: String, enum: ["inbound_cancellation", "outbound_confirmation"] } },
  { strict: false, timestamps: true },
);
const Call = mongoose.model("Call", callSchema, "calls");

const app = express();
const PORT = 5000;
const FONIO_API_KEY = process.env.FONIO_API_KEY!;
const FONIO_FROM_NUMBER = "+4369919210575";
const OUTBOUND_CALL_URL = "https://app.fonio.ai/api/public/v1/outbound_call";

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, "../../.alfred.iam.json"),
  scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
});
const calendar = google.calendar({ version: "v3", auth });

app.use(express.json());

interface WaitlistPerson {
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

async function pickNextPersonFromWaitlist(): Promise<WaitlistPerson> {
  // placeholder — replace with real DB/CRM lookup
  return {
    phone: "+4367761244487",
    firstName: "Philipp",
    lastName: "Scheer",
    email: "scheer28philipp@gmail.com",
    appointmentDateTime: "18.06.2026 10:00",
    appointmentType: "Dental Appointment",
  };
}

async function callPersonAndScheduleBlock(
  person: WaitlistPerson,
  newSlot: AppointmentDetails,
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
    },
  };

  console.log("[outbound] calling", person.firstName, person.lastName, person.phone);
  console.log("[outbound] old slot:", person.appointmentDateTime, person.appointmentType);
  console.log("[outbound] new slot:", newSlot.appointmentStart, newSlot.appointmentType);
  const response = await axios.post(OUTBOUND_CALL_URL, payload);
  console.log("[outbound] call initiated:", response.data);
}

async function handleCancelledAppointment(): Promise<void> {
  const [person, appointment] = await Promise.all([
    pickNextPersonFromWaitlist(),
    getRecentlyCancelledCalendarEvent(),
  ]);

  if (!appointment) {
    console.error(
      "[handler] could not find cancelled calendar event — aborting",
    );
    return;
  }

  console.log("[slot] freed up:", appointment);
  console.log(
    "[outbound] will offer to:",
    person.firstName,
    person.lastName,
    "—",
    person.appointmentDateTime,
    person.appointmentType,
  );

  await callPersonAndScheduleBlock(person, appointment);
}

app.post("/webhook/cancelled-appointment", (req: Request, res: Response) => {
  console.log("[webhook] cancelled-appointment received:");
  console.log(JSON.stringify(req.body, null, 2));

  new Call({ ...req.body, callType: "inbound_cancellation" }).save().catch((err) =>
    console.error("[mongodb] save error:", err),
  );

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

  new Call({ ...req.body, callType: "outbound_confirmation" }).save().catch((err) =>
    console.error("[mongodb] save error:", err),
  );

  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
