import { ObjectId } from "mongodb"

import { getDb } from "./mongo"

// The Fonio webhook server (app/src/index.ts) uses mongoose with no explicit
// database name, so call documents land in the connection's default `test` db.
const CALLS_DB = process.env.MONGODB_CALLS_DB || "test"
const CALLS_COLLECTION = "calls"

// ---- Types (mirror the `test.calls` documents) ----

export type CallType = "inbound_cancellation" | "outbound_confirmation" | string
export type CallDirection = "inbound" | "outbound" | string
export type TranscriptRole = "user" | "agent" | "tool" | string

export interface TranscriptEntry {
  id: string
  content: string
  role: TranscriptRole
  timestampSecond: number
  index: number
}

export interface CallContext {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  appointment_new_date?: string
  appointment_new_time?: string
  appointment_new_type?: string
  appointment_old_date?: string
  appointment_old_time?: string
  appointment_old_type?: string
  [key: string]: unknown
}

export interface Call {
  _id: string
  callType: CallType
  summary: string | null
  transcript: TranscriptEntry[]
  formattedTranscript?: string | null
  formattedPlainTranscript?: string | null
  fromNumber: string | null
  toNumber: string | null
  direction: CallDirection
  duration: number
  disconnectReason: string | null
  startTimestamp: string | null
  endTimestamp: string | null
  audioLink: string | null
  context: CallContext | null
  extractionData?: { didCancel?: boolean } | null
  createdAt: string | null
  updatedAt: string | null
}

/** Lighter shape for the dashboard list. */
export interface CallSummary {
  _id: string
  callType: CallType
  direction: CallDirection
  summary: string | null
  counterpartName: string | null
  counterpartNumber: string | null
  duration: number
  messageCount: number
  connected: boolean
  startTimestamp: string | null
  createdAt: string | null
}

// JSON round-trip turns BSON values (ObjectId, Date) into plain serializable
// values so results are safe to hand to client components.
function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T
}

/** Best-effort display name for the patient on the other end of the call. */
export function counterpartName(call: {
  context?: CallContext | null
  direction: CallDirection
}): string | null {
  const ctx = call.context
  const name = [ctx?.first_name, ctx?.last_name].filter(Boolean).join(" ").trim()
  return name || null
}

export async function getCalls(): Promise<CallSummary[]> {
  const db = await getDb(CALLS_DB)
  const docs = await db
    .collection(CALLS_COLLECTION)
    .find({})
    .sort({ startTimestamp: -1, createdAt: -1 })
    .toArray()

  return docs.map((raw) => {
    const c = serialize<Call>(raw)
    const transcript = c.transcript ?? []
    return {
      _id: c._id,
      callType: c.callType,
      direction: c.direction,
      summary: c.summary ?? null,
      counterpartName: counterpartName(c),
      counterpartNumber: c.direction === "outbound" ? c.toNumber : c.fromNumber,
      duration: c.duration ?? 0,
      messageCount: transcript.filter((t) => t.role !== "tool").length,
      connected: transcript.length > 0,
      startTimestamp: c.startTimestamp,
      createdAt: c.createdAt,
    }
  })
}

export async function getCall(id: string): Promise<Call | null> {
  let _id: ObjectId
  try {
    _id = ObjectId.createFromHexString(id)
  } catch {
    return null
  }

  const db = await getDb(CALLS_DB)
  const raw = await db.collection(CALLS_COLLECTION).findOne({ _id })
  if (!raw) return null
  return serialize<Call>(raw)
}
