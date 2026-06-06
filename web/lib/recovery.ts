import { getDb } from "./mongo"

// ---- Types (mirror the `recovery_sessions` collection) ----

export interface RecoverySlot {
  _id: string
  treatmentType: string
  startTime: string
  durationMin: number
  status: string
  source: string
  createdAt: string
}

export interface CandidateContribution {
  variable: string
  score: number
  weight: number
  contribution: number
}

export interface RankedCandidate {
  patient_id: string
  waitlist_id: string
  name: string
  phone: string
  patientType: string
  finalScore: number
  variableScores: Record<string, number>
  contributions: CandidateContribution[]
  hardFilterPassed: boolean
  patient: Record<string, unknown>
  rank: number
}

export type AttemptStatus = "COMPLETED" | "IN_PROGRESS" | "FAILED" | string
export type AttemptOutcome =
  | "ACCEPTED"
  | "DECLINED"
  | "NO_ANSWER"
  | "PENDING"
  | string

export interface Attempt {
  patient_id: string
  name: string
  phone: string
  rank: number
  finalScore: number
  status: AttemptStatus
  outcome: AttemptOutcome
  startedAt: string
  endedAt?: string
}

export interface RecoverySession {
  _id: string
  slot: RecoverySlot
  status: string
  rankedCandidates: RankedCandidate[]
  attempts: Attempt[]
  currentIndex: number
  createdAt: string
  updatedAt: string
}

/** A lighter shape for list views. */
export interface RecoverySessionSummary {
  _id: string
  slot: RecoverySlot
  status: string
  attemptCount: number
  currentIndex: number
  candidateCount: number
  lastAttempt: Attempt | null
  topCandidateName: string | null
  createdAt: string
  updatedAt: string
}

// JSON round-trip strips BSON/Date types into plain serializable values
// (Dates -> ISO strings) so results are safe to pass to client components.
function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T
}

export async function getRecoverySessions(): Promise<RecoverySessionSummary[]> {
  const db = await getDb()
  const docs = await db
    .collection("recovery_sessions")
    .find({})
    .sort({ updatedAt: -1, createdAt: -1 })
    .toArray()

  return docs.map((raw) => {
    const d = serialize<RecoverySession>(raw)
    const attempts = d.attempts ?? []
    return {
      _id: d._id,
      slot: d.slot,
      status: d.status,
      attemptCount: attempts.length,
      currentIndex: d.currentIndex ?? 0,
      candidateCount: d.rankedCandidates?.length ?? 0,
      lastAttempt: attempts.length ? attempts[attempts.length - 1] : null,
      topCandidateName: d.rankedCandidates?.[0]?.name ?? null,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }
  })
}

export async function getRecoverySession(
  id: string,
): Promise<RecoverySession | null> {
  const db = await getDb()
  const raw = await db.collection("recovery_sessions").findOne({ _id: id as never })
  if (!raw) return null
  return serialize<RecoverySession>(raw)
}
