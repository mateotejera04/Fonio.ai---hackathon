import path from "path"
import dotenv from "dotenv"
import { MongoClient, Db } from "mongodb"

// MONGODB_URI lives in the repo-root .env, one level above web/.
dotenv.config({ path: path.resolve(process.cwd(), "../.env") })

const uri = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || "fonio"

if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to the repo-root .env file.")
}

// Reuse the client across hot-reloads in dev to avoid exhausting connections.
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>
}

function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri as string)
    globalForMongo._mongoClientPromise = client.connect()
  }
  return globalForMongo._mongoClientPromise
}

export async function getDb(dbName?: string): Promise<Db> {
  const client = await getClientPromise()
  return client.db(dbName ?? DB_NAME)
}
