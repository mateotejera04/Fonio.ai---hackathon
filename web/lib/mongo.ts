import path from "path"
import dotenv from "dotenv"
import { MongoClient, Db } from "mongodb"

// In local dev, MONGODB_URI lives in the repo-root .env, one level above web/.
// In production it is injected into the container environment (compose env_file),
// so a missing file here is harmless — dotenv just no-ops.
dotenv.config({ path: path.resolve(process.cwd(), "../.env") })

const DB_NAME = process.env.MONGODB_DB || "fonio"

// Reuse the client across hot-reloads in dev to avoid exhausting connections.
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>
}

function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    // Read the URI lazily so importing this module never throws — the check
    // runs at request time, not at build/module-evaluation time.
    const uri = process.env.MONGODB_URI
    if (!uri) {
      throw new Error("MONGODB_URI is not set. Provide it via the environment.")
    }
    const client = new MongoClient(uri)
    globalForMongo._mongoClientPromise = client.connect()
  }
  return globalForMongo._mongoClientPromise
}

export async function getDb(dbName?: string): Promise<Db> {
  const client = await getClientPromise()
  return client.db(dbName ?? DB_NAME)
}
