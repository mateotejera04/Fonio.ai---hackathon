import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
import axios from "axios";

const payload = {
  apiKey: process.env.FONIO_API_KEY,
  fromNumber: "+4369919210575",
  toNumber: "+4367761244487",
  context: {
    first_name: "Philipp",
    last_name: "Scheer",
    phone: "+4367761244487",
    email: "scheer28philipp@gmail.com",
    appointment_date: "10.06.2026",
    appointment_time: "09:00",
    appointment_type: "Dental checkup",
    duration_min: "30",
  },
};

async function run() {
  console.log("Sending simulated cancelled-appointment webhook...");
  const res = await axios.post(
    "https://app.fonio.ai/api/public/v1/outbound_call",
    payload,
  );
  console.log("Response:", res.status, res.data);
}

run().catch(console.error);
