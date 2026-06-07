import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import axios from "axios";

const FIRST_NAMES = ["Anna", "Max", "Lena", "Tom", "Sophie", "Jonas"];
const LAST_NAMES = ["Müller", "Bauer", "Hofer", "Gruber", "Wagner", "Steiner"];
const APPOINTMENT_TYPES = [
  "Dental checkup",
  "Cleaning",
  "Cavity filling",
  "Root canal",
  "Hygiene",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTime(): string {
  const hour = 8 + Math.floor(Math.random() * 10); // 08 - 17
  const minute = pick(["00", "15", "30", "45"]);
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function randomDate(): string {
  const base = new Date(2026, 5, 1); // base of June 2026 (month is 0-indexed)
  const offsetDays = Math.floor(Math.random() * 14);
  const date = new Date(base);
  date.setDate(date.getDate() + offsetDays);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const newDate = randomDate();
const newTime = randomTime();

const payload = {
  apiKey: process.env.FONIO_API_KEY,
  fromNumber: "+4369919210575",
  toNumber: "+4367761244487",
  context: {
    first_name: pick(FIRST_NAMES),
    last_name: pick(LAST_NAMES),
    phone: "+4367761244487",
    email: "scheer28philipp@gmail.com",
    appointment_old_date: randomDate(),
    appointment_old_time: randomTime(),
    appointment_old_type: pick(APPOINTMENT_TYPES),
    appointment_new_date: newDate,
    appointment_new_time: newTime,
    appointment_new_type: pick(APPOINTMENT_TYPES),
    waitlist_id: `test-${randomId()}`,
    slot_id: `slot-${newDate.replace(/\./g, "")}-${newTime.replace(":", "")}`,
    booking_number: 1,
    callback_count: 0,
  },
};

async function run() {
  console.log("Generated context:", payload.context);
  console.log("Sending test voicemail outbound call...");
  const res = await axios.post(
    "https://app.fonio.ai/api/public/v1/outbound_call",
    payload,
  );
  console.log("Response:", res.status, res.data);
}

run().catch(console.error);
