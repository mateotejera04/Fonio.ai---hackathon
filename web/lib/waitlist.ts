import { getDb } from "./mongo"

// ---- Types (mirror the `waitlist` collection / app/src/db/types.ts) ----

export type Treatment = "Cleaning" | "Checkup" | "Pain"
export type TimeWindow = "Morning" | "Afternoon" | "Any time"
export type Occupation =
  | "Student"
  | "Part-time worker"
  | "Full-time worker"
  | "Unknown"
export type WaitlistStatus =
  | "QUEUED"
  | "CONTACTING"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "NEEDS_HUMAN"

/** Client-safe shape: BSON/Date stripped via JSON round-trip. */
export interface WaitlistPatient {
  _id: string
  patient_id: string
  waitlist_id: string
  name: string
  phone: string

  consent_call: boolean
  consent_message: boolean
  desired_treatment: Treatment
  home_distance_min: number
  work_distance_min: number
  already_rejected_slots: string[]
  being_contacted_for_slots: string[]
  preferred_time_window: TimeWindow

  has_current_appointment: boolean
  wants_earlier_slot: boolean
  occupation: Occupation
  last_minute_accepted: number
  no_response_count: number
  cancellation_count: number
  no_show_count: number
  waitlist_since: string
  visits_last_12_months: number

  waitlist_status: WaitlistStatus
  createdAt: string
  updatedAt: string
}

export interface VariableScores {
  urgency: number
  proximity: number
  occupationFlexibility: number
  lastMinuteAcceptance: number
  noResponse: number
  cancellationHistory: number
  noShowHistory: number
  waitlistAge: number
  visitFrequency: number
}

export type PatientType = "assigned" | "unassigned"

/** One line in the "why this score" breakdown. contribution = weight * score. */
export interface ScoreContribution {
  key: keyof VariableScores
  label: string
  detail: string
  score: number
  weight: number
  contribution: number
}

export interface RankedWaitlistPatient extends WaitlistPatient {
  patientType: PatientType
  finalScore: number
  variableScores: VariableScores
  contributions: ScoreContribution[]
  hardFilterPassed: boolean
  filteredReason?: string
  rank: number | null
  daysWaiting: number
}

// JSON round-trip strips BSON/Date types into plain serializable values
// (Dates -> ISO strings) so results are safe to pass to client components.
function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T
}

// ---- Stage 5 weights (Section "Patient Type & Formula") ----

interface FormulaWeights {
  urgency: number
  occupationFlexibility: number
  proximity: number
  lastMinuteAcceptance: number
  waitlistAge: number
  visitFrequency: number
  noResponse: number
  cancellationHistory: number
  noShowHistory: number
}

const ASSIGNED_WEIGHTS: FormulaWeights = {
  urgency: 0.31,
  occupationFlexibility: 0.19,
  proximity: 0.15,
  lastMinuteAcceptance: 0.1,
  waitlistAge: 0.09,
  visitFrequency: 0.06,
  noResponse: 0.05,
  cancellationHistory: 0.04,
  noShowHistory: 0.01,
}

const UNASSIGNED_WEIGHTS: FormulaWeights = {
  urgency: 0.3,
  waitlistAge: 0.18,
  occupationFlexibility: 0.15,
  proximity: 0.12,
  lastMinuteAcceptance: 0.08,
  visitFrequency: 0.07,
  noResponse: 0.05,
  cancellationHistory: 0.03,
  noShowHistory: 0.02,
}

// ---- Stage 3: individual variable scores (pure functions, 0.0-1.0) ----

export function scoreUrgency(treatment: Treatment): number {
  switch (treatment) {
    case "Pain":
      return 1.0
    case "Checkup":
      return 0.6
    case "Cleaning":
      return 0.3
    default:
      return 0.5
  }
}

export function scoreProximity(homeMin: number, workMin: number): number {
  const bestDistance = Math.min(homeMin, workMin)
  if (bestDistance <= 10) return 1.0
  if (bestDistance <= 20) return 0.8
  if (bestDistance <= 30) return 0.5
  if (bestDistance <= 45) return 0.3
  return 0.1
}

export function scoreOccupationFlexibility(occupation: Occupation): number {
  switch (occupation) {
    case "Student":
      return 0.9
    case "Part-time worker":
      return 0.8
    case "Full-time worker":
      return 0.4
    case "Unknown":
    default:
      return 0.5
  }
}

export function scoreLastMinuteAcceptance(count: number): number {
  if (count >= 3) return 1.0
  if (count === 2) return 0.8
  if (count === 1) return 0.6
  return 0.4
}

export function scoreNoResponse(count: number): number {
  if (count === 0) return 1.0
  if (count === 1) return 0.8
  if (count === 2) return 0.5
  return 0.2
}

export function scoreCancellationHistory(count: number): number {
  if (count === 0) return 1.0
  if (count === 1) return 0.8
  if (count === 2) return 0.5
  return 0.2
}

export function scoreNoShowHistory(count: number): number {
  if (count === 0) return 1.0
  if (count === 1) return 0.7
  if (count === 2) return 0.4
  return 0.1
}

export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((to.getTime() - from.getTime()) / msPerDay)
}

export function scoreWaitlistAge(daysWaiting: number): number {
  if (daysWaiting >= 30) return 1.0
  if (daysWaiting >= 14) return 0.8
  if (daysWaiting >= 7) return 0.5
  return 0.3
}

export function scoreVisitFrequency(visits: number): number {
  if (visits >= 4) return 1.0
  if (visits >= 2) return 0.7
  if (visits === 1) return 0.4
  return 0.2
}

// ---- Hard filter (Stage 1, slot-independent: only filter #1 applies) ----

export interface HardFilterResult {
  passed: boolean
  reason?: string
}

export function applyHardFilters(patient: {
  consent_call: boolean
  consent_message: boolean
}): HardFilterResult {
  if (!patient.consent_call && !patient.consent_message) {
    return { passed: false, reason: "No contact consent" }
  }
  return { passed: true }
}

// ---- Stage 5: final scoring ----

export interface ScoredPatient {
  patientType: PatientType
  finalScore: number
  variableScores: VariableScores
  contributions: ScoreContribution[]
  daysWaiting: number
}

// Human labels + how each variable reads off the patient's data, for the
// "why this score" breakdown.
const VARIABLE_LABELS: Record<keyof VariableScores, string> = {
  urgency: "Urgency",
  proximity: "Proximity",
  occupationFlexibility: "Occupation flexibility",
  lastMinuteAcceptance: "Last-minute acceptance",
  noResponse: "No-response history",
  cancellationHistory: "Cancellation history",
  noShowHistory: "No-show history",
  waitlistAge: "Waitlist age",
  visitFrequency: "Visit frequency",
}

function pluralize(n: number, singular: string): string {
  return `${n} ${singular}${n === 1 ? "" : "s"}`
}

/** Pure function: scores one patient relative to `today` (no freed slot, multiplier = 1.0). */
export function scoreWaitlistPatient(
  patient: Pick<
    WaitlistPatient,
    | "desired_treatment"
    | "home_distance_min"
    | "work_distance_min"
    | "occupation"
    | "last_minute_accepted"
    | "no_response_count"
    | "cancellation_count"
    | "no_show_count"
    | "waitlist_since"
    | "visits_last_12_months"
    | "has_current_appointment"
  >,
  today: Date
): ScoredPatient {
  const daysWaiting = daysBetween(new Date(patient.waitlist_since), today)

  const variableScores: VariableScores = {
    urgency: scoreUrgency(patient.desired_treatment),
    proximity: scoreProximity(patient.home_distance_min, patient.work_distance_min),
    occupationFlexibility: scoreOccupationFlexibility(patient.occupation),
    lastMinuteAcceptance: scoreLastMinuteAcceptance(patient.last_minute_accepted),
    noResponse: scoreNoResponse(patient.no_response_count),
    cancellationHistory: scoreCancellationHistory(patient.cancellation_count),
    noShowHistory: scoreNoShowHistory(patient.no_show_count),
    waitlistAge: scoreWaitlistAge(daysWaiting),
    visitFrequency: scoreVisitFrequency(patient.visits_last_12_months),
  }

  const patientType: PatientType = patient.has_current_appointment
    ? "assigned"
    : "unassigned"
  const weights = patientType === "assigned" ? ASSIGNED_WEIGHTS : UNASSIGNED_WEIGHTS

  const bestDistance = Math.min(
    patient.home_distance_min,
    patient.work_distance_min
  )
  const details: Record<keyof VariableScores, string> = {
    urgency: `${patient.desired_treatment} treatment`,
    proximity: `${bestDistance} min away (closest)`,
    occupationFlexibility: patient.occupation,
    lastMinuteAcceptance: `${patient.last_minute_accepted} accepted before`,
    noResponse: pluralize(patient.no_response_count, "missed call"),
    cancellationHistory: pluralize(patient.cancellation_count, "cancellation"),
    noShowHistory: pluralize(patient.no_show_count, "no-show"),
    waitlistAge: pluralize(daysWaiting, "day") + " waiting",
    visitFrequency: `${patient.visits_last_12_months} visits in 12 months`,
  }

  // No freed slot -> proximity modifier multiplier is 1.0, base weights apply as-is.
  const contributions: ScoreContribution[] = (
    Object.keys(variableScores) as (keyof VariableScores)[]
  )
    .map((key) => {
      const score = variableScores[key]
      const weight = weights[key]
      return {
        key,
        label: VARIABLE_LABELS[key],
        detail: details[key],
        score,
        weight,
        contribution: weight * score,
      }
    })
    // Biggest drivers of the score first.
    .sort((a, b) => b.contribution - a.contribution)

  const finalScore = contributions.reduce((sum, c) => sum + c.contribution, 0)

  return { patientType, finalScore, variableScores, contributions, daysWaiting }
}

// ---- Data access ----

export async function getRankedWaitlist(): Promise<RankedWaitlistPatient[]> {
  const db = await getDb()
  const docs = await db.collection("waitlist").find({}).toArray()
  const today = new Date()

  const ranked: RankedWaitlistPatient[] = docs.map((raw) => {
    const patient = serialize<WaitlistPatient>(raw)
    const { passed, reason } = applyHardFilters(patient)
    const { patientType, finalScore, variableScores, contributions, daysWaiting } =
      scoreWaitlistPatient(patient, today)

    return {
      ...patient,
      patientType,
      finalScore,
      variableScores,
      contributions,
      hardFilterPassed: passed,
      filteredReason: reason,
      rank: null,
      daysWaiting,
    }
  })

  // Passing candidates first, descending by finalScore, tie-break by waitlistAge score.
  // Filtered (no-consent) candidates always last.
  ranked.sort((a, b) => {
    if (a.hardFilterPassed !== b.hardFilterPassed) {
      return a.hardFilterPassed ? -1 : 1
    }
    if (!a.hardFilterPassed) return 0
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore
    return b.variableScores.waitlistAge - a.variableScores.waitlistAge
  })

  let nextRank = 1
  for (const candidate of ranked) {
    if (candidate.hardFilterPassed) {
      candidate.rank = nextRank
      nextRank += 1
    }
  }

  return ranked
}
