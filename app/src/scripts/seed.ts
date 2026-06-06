// Seed the `waitlist` collection from samples.csv.
//
// Idempotent: each row upserts by patient_id (_id), so re-running updates rather
// than duplicating. Run with `npm run seed` from the app/ directory.

import fs from 'fs';
import path from 'path';
import { closeDb, getWaitlist } from '../db/client';
import {
  Occupation,
  TimeWindow,
  Treatment,
  WaitlistPatient,
  WaitlistStatus,
} from '../db/types';

const CSV_PATH = path.resolve(__dirname, '../../../samples.csv');

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

const yesNo = (v: string): boolean => v.toLowerCase() === 'yes';

// Numeric cell -> number, blank -> null.
const numOrNull = (v: string): number | null => {
  if (v === '' || v.toUpperCase() === 'N/A') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

// Numeric cell -> number, blank/invalid -> fallback (used for counts).
const numOr = (v: string, fallback: number): number => {
  const n = numOrNull(v);
  return n === null ? fallback : n;
};

// "S0002,S0003" or "" -> string[]
const slotList = (v: string): string[] =>
  v
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== 'none');

function toDoc(row: Record<string, string>): WaitlistPatient {
  const now = new Date();
  return {
    _id: row['patient_id'],
    patient_id: row['patient_id'],
    waitlist_id: row['waitlist_id'],
    name: row['name'],
    phone: row['phone'],

    consent_call: yesNo(row['consent_call']),
    consent_message: yesNo(row['consent_message']),
    desired_treatment: row['desired_treatment'] as Treatment,
    home_distance_min: numOr(row['home_distance_min'], 0),
    work_distance_min: numOr(row['work_distance_min'], 0),
    already_rejected_slots: slotList(row['already_rejected_slots']),
    being_contacted_for_slots: slotList(row['being_contacted_for_slots']),
    preferred_time_window: (row['preferred_time_window'] || 'Any time') as TimeWindow,

    has_current_appointment: yesNo(row['has_current_appointment']),
    // header in the CSV is "current_appointment days left"
    current_appointment_days_left: numOrNull(row['current_appointment days left']),
    wants_earlier_slot: yesNo(row['wants_earlier_slot']),
    occupation: (row['occupation'] || 'Unknown') as Occupation,
    last_minute_accepted: numOr(row['last_minute_accepted'], 0),
    no_response_count: numOr(row['no_response_count'], 0),
    cancellation_count: numOr(row['cancellation_count'], 0),
    no_show_count: numOr(row['no_show_count'], 0),
    waitlist_since: new Date(row['waitlist_since']),
    visits_last_12_months: numOr(row['visits_last_12_months'], 0),

    waitlist_status: (row['waitlist_status'] || 'QUEUED') as WaitlistStatus,
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found at ${CSV_PATH}`);
  }

  const rows = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  console.log(`Parsed ${rows.length} rows from ${path.basename(CSV_PATH)}`);

  const waitlist = await getWaitlist();

  const ops = rows.map((row) => {
    const doc = toDoc(row);
    const { _id, createdAt, ...rest } = doc;
    return {
      updateOne: {
        filter: { _id },
        // don't overwrite createdAt on re-seed
        update: { $set: rest, $setOnInsert: { createdAt } },
        upsert: true,
      },
    };
  });

  const result = await waitlist.bulkWrite(ops);
  console.log(
    `Upserted: ${result.upsertedCount} new, ${result.modifiedCount} updated, ${result.matchedCount} matched`
  );

  await waitlist.createIndex({ waitlist_status: 1 });
  await waitlist.createIndex({ desired_treatment: 1 });
  await waitlist.createIndex({ preferred_time_window: 1 });
  console.log('Indexes ensured. Total docs:', await waitlist.countDocuments());

  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
