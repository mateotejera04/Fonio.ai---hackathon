// Port of the waitlist ranking engine from `web/lib/waitlist.ts`, adapted to
// operate on the backend's `WaitlistPatient` type (native `mongodb` driver
// shape — `waitlist_since` is a real `Date`, Yes/No fields are booleans).
//
// Keep this byte-for-byte equivalent to the web version: same 9 score
// functions, same ASSIGNED/UNASSIGNED weight tables, same hard filter (only
// the consent filter applies — slot-independent, proximity multiplier = 1.0,
// no freed-slot logic), and the same sort/ranking order.

import { Occupation, Treatment, WaitlistPatient } from './db/types';

export interface VariableScores {
  urgency: number;
  proximity: number;
  occupationFlexibility: number;
  lastMinuteAcceptance: number;
  noResponse: number;
  cancellationHistory: number;
  noShowHistory: number;
  waitlistAge: number;
  visitFrequency: number;
}

export type PatientType = 'assigned' | 'unassigned';

export interface RankedWaitlistPatient extends WaitlistPatient {
  patientType: PatientType;
  finalScore: number;
  variableScores: VariableScores;
  hardFilterPassed: boolean;
  filteredReason?: string;
  rank: number | null;
  daysWaiting: number;
}

// ---- Stage 5 weights (Section "Patient Type & Formula") ----

interface FormulaWeights {
  urgency: number;
  occupationFlexibility: number;
  proximity: number;
  lastMinuteAcceptance: number;
  waitlistAge: number;
  visitFrequency: number;
  noResponse: number;
  cancellationHistory: number;
  noShowHistory: number;
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
};

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
};

// ---- Stage 3: individual variable scores (pure functions, 0.0-1.0) ----

export function scoreUrgency(treatment: Treatment): number {
  switch (treatment) {
    case 'Pain':
      return 1.0;
    case 'Checkup':
      return 0.6;
    case 'Cleaning':
      return 0.3;
    default:
      return 0.5;
  }
}

export function scoreProximity(homeMin: number, workMin: number): number {
  const bestDistance = Math.min(homeMin, workMin);
  if (bestDistance <= 10) return 1.0;
  if (bestDistance <= 20) return 0.8;
  if (bestDistance <= 30) return 0.5;
  if (bestDistance <= 45) return 0.3;
  return 0.1;
}

export function scoreOccupationFlexibility(occupation: Occupation): number {
  switch (occupation) {
    case 'Student':
      return 0.9;
    case 'Part-time worker':
      return 0.8;
    case 'Full-time worker':
      return 0.4;
    case 'Unknown':
    default:
      return 0.5;
  }
}

export function scoreLastMinuteAcceptance(count: number): number {
  if (count >= 3) return 1.0;
  if (count === 2) return 0.8;
  if (count === 1) return 0.6;
  return 0.4;
}

export function scoreNoResponse(count: number): number {
  if (count === 0) return 1.0;
  if (count === 1) return 0.8;
  if (count === 2) return 0.5;
  return 0.2;
}

export function scoreCancellationHistory(count: number): number {
  if (count === 0) return 1.0;
  if (count === 1) return 0.8;
  if (count === 2) return 0.5;
  return 0.2;
}

export function scoreNoShowHistory(count: number): number {
  if (count === 0) return 1.0;
  if (count === 1) return 0.7;
  if (count === 2) return 0.4;
  return 0.1;
}

export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

export function scoreWaitlistAge(daysWaiting: number): number {
  if (daysWaiting >= 30) return 1.0;
  if (daysWaiting >= 14) return 0.8;
  if (daysWaiting >= 7) return 0.5;
  return 0.3;
}

export function scoreVisitFrequency(visits: number): number {
  if (visits >= 4) return 1.0;
  if (visits >= 2) return 0.7;
  if (visits === 1) return 0.4;
  return 0.2;
}

// ---- Hard filter (Stage 1, slot-independent: only filter #1 applies) ----

export interface HardFilterResult {
  passed: boolean;
  reason?: string;
}

export function applyHardFilters(patient: {
  consent_call: boolean;
  consent_message: boolean;
}): HardFilterResult {
  if (!patient.consent_call) {
    return { passed: false, reason: 'No call consent' };
  }
  return { passed: true };
}

// ---- Stage 5: final scoring ----

export interface ScoredPatient {
  patientType: PatientType;
  finalScore: number;
  variableScores: VariableScores;
  daysWaiting: number;
}

/** Pure function: scores one patient relative to `today` (no freed slot, multiplier = 1.0). */
export function scoreWaitlistPatient(
  patient: Pick<
    WaitlistPatient,
    | 'desired_treatment'
    | 'home_distance_min'
    | 'work_distance_min'
    | 'occupation'
    | 'last_minute_accepted'
    | 'no_response_count'
    | 'cancellation_count'
    | 'no_show_count'
    | 'waitlist_since'
    | 'visits_last_12_months'
    | 'has_current_appointment'
  >,
  today: Date,
): ScoredPatient {
  // `waitlist_since` is a JS `Date` in this collection; wrap defensively in
  // case the driver ever hands back a string/serialized value.
  const daysWaiting = daysBetween(new Date(patient.waitlist_since), today);

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
  };

  const patientType: PatientType = patient.has_current_appointment ? 'assigned' : 'unassigned';
  const weights = patientType === 'assigned' ? ASSIGNED_WEIGHTS : UNASSIGNED_WEIGHTS;

  // No freed slot -> proximity modifier multiplier is 1.0, base weights apply as-is.
  const finalScore = (Object.keys(variableScores) as (keyof VariableScores)[]).reduce(
    (sum, key) => sum + weights[key] * variableScores[key],
    0,
  );

  return { patientType, finalScore, variableScores, daysWaiting };
}

// ---- Ranking ----

export function rankWaitlist(
  patients: WaitlistPatient[],
  today: Date = new Date(),
): RankedWaitlistPatient[] {
  const ranked: RankedWaitlistPatient[] = patients.map((patient) => {
    const { passed, reason } = applyHardFilters(patient);
    const { patientType, finalScore, variableScores, daysWaiting } = scoreWaitlistPatient(
      patient,
      today,
    );

    return {
      ...patient,
      patientType,
      finalScore,
      variableScores,
      hardFilterPassed: passed,
      filteredReason: reason,
      rank: null,
      daysWaiting,
    };
  });

  // Passing candidates first, descending by finalScore, tie-break by waitlistAge score.
  // Filtered (no-consent) candidates always last.
  ranked.sort((a, b) => {
    if (a.hardFilterPassed !== b.hardFilterPassed) {
      return a.hardFilterPassed ? -1 : 1;
    }
    if (!a.hardFilterPassed) return 0;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return b.variableScores.waitlistAge - a.variableScores.waitlistAge;
  });

  let nextRank = 1;
  for (const candidate of ranked) {
    if (candidate.hardFilterPassed) {
      candidate.rank = nextRank;
      nextRank += 1;
    }
  }

  return ranked;
}
