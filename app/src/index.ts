import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express, { Request, Response } from 'express';
import axios from 'axios';
import { google } from 'googleapis';

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const FONIO_API_KEY = process.env.FONIO_API_KEY!;
const FONIO_FROM_NUMBER = '+4369919210575';
const OUTBOUND_CALL_URL = 'https://app.fonio.ai/api/public/v1/outbound_call';

const auth = new google.auth.GoogleAuth({
  keyFile: path.resolve(__dirname, '../../.alfred.iam.json'),
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});
const calendar = google.calendar({ version: 'v3', auth });

app.use(express.json());

interface WaitlistPerson {
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface AppointmentDetails {
  appointmentStart: string;  // DD.MM.YYYY HH:MM
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
    calendarId: 'scheer28philipp@gmail.com',
    showDeleted: true,
    updatedMin,
    singleEvents: true,
    orderBy: 'updated',
  });

  const cancelled = (res.data.items ?? [])
    .filter(e => e.status === 'cancelled')
    .sort((a, b) => new Date(b.updated!).getTime() - new Date(a.updated!).getTime());

  if (cancelled.length === 0) {
    console.warn('[calendar] no recently cancelled event found in the last 15 minutes');
    return null;
  }

  const event = cancelled[0];
  console.log('[calendar] matched cancelled event:', event.summary, event.start?.dateTime);

  const start = new Date(event.start?.dateTime ?? event.start?.date ?? '');
  const end = new Date(event.end?.dateTime ?? event.end?.date ?? '');
  const durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

  const pad = (n: number) => String(n).padStart(2, '0');
  const appointmentStart = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}.${start.getFullYear()} ${pad(start.getHours())}:${pad(start.getMinutes())}`;

  return {
    appointmentStart,
    appointmentType: event.summary ?? 'Dental appointment',
    durationMin,
  };
}

async function pickNextPersonFromWaitlist(): Promise<WaitlistPerson> {
  // placeholder — replace with real DB/CRM lookup
  return {
    phone: '+4367761244487',
    firstName: 'Philipp',
    lastName: 'Scheer',
    email: 'scheer28philipp@gmail.com',
  };
}

async function callPersonAndScheduleBlock(
  person: WaitlistPerson,
  appointmentDate: string,
  appointmentTime: string,
  appointmentType: string,
  durationMin: number,
): Promise<void> {
  const payload = {
    apiKey: FONIO_API_KEY,
    fromNumber: FONIO_FROM_NUMBER,
    toNumber: person.phone,
    context: {
      first_name: person.firstName,
      last_name: person.lastName,
      phone: person.phone,
      email: person.email,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      appointment_type: appointmentType,
      duration_min: String(durationMin),
    },
  };

  console.log('[outbound] initiating call to', person.phone);
  const response = await axios.post(OUTBOUND_CALL_URL, payload);
  console.log('[outbound] call initiated:', response.data);
}

async function handleCancelledAppointment(): Promise<void> {
  const [person, appointment] = await Promise.all([
    pickNextPersonFromWaitlist(),
    getRecentlyCancelledCalendarEvent(),
  ]);

  if (!appointment) {
    console.error('[handler] could not find cancelled calendar event — aborting');
    return;
  }

  const [appointmentDate, appointmentTime] = appointment.appointmentStart.split(' ');
  console.log('[slot]', appointment);

  await callPersonAndScheduleBlock(person, appointmentDate, appointmentTime, appointment.appointmentType, appointment.durationMin);
}

app.post('/webhook/cancelled-appointment', (req: Request, res: Response) => {
  console.log('[webhook] cancelled-appointment received:');
  console.log(JSON.stringify(req.body, null, 2));

  if (req.body?.extractionData?.didCancel === true) {
    res.status(200).json({ received: true });
    handleCancelledAppointment().catch(console.error);
    return;
  }

  res.status(200).json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
