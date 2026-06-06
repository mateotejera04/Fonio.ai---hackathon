import path from 'path';
import dotenv from 'dotenv';
import { MongoClient, Db, Collection } from 'mongodb';
import { WaitlistPatient } from './types';

// .env lives at the repo root, one level above app/.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI is not set. Add it to the repo-root .env file.');
}

export const DB_NAME = process.env.MONGODB_DB || 'fonio';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri as string);
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

export async function getWaitlist(): Promise<Collection<WaitlistPatient>> {
  const database = await getDb();
  return database.collection<WaitlistPatient>('waitlist');
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
