// Waitlist patient document.
//
// Keys mirror the CSV columns from ranking.md ("field names match the CSV
// columns exactly") so the ranking engine maps 1:1 to the spec. Value types are
// normalized for storage: Yes/No -> boolean, numeric strings -> number,
// slot-id lists -> string[], dates -> Date, blanks -> null.

export type Treatment = 'Cleaning' | 'Checkup' | 'Pain';
export type TimeWindow = 'Morning' | 'Afternoon' | 'Any time';
export type Occupation =
  | 'Student'
  | 'Part-time worker'
  | 'Full-time worker'
  | 'Unknown';
export type WaitlistStatus =
  | 'QUEUED'
  | 'CONTACTING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'NEEDS_HUMAN';

export interface WaitlistPatient {
  _id: string; // == patient_id, so re-seeding is idempotent
  patient_id: string;
  waitlist_id: string;
  name: string;
  phone: string;

  // Hard-filter inputs
  consent_call: boolean;
  consent_message: boolean;
  desired_treatment: Treatment;
  home_distance_min: number;
  work_distance_min: number;
  already_rejected_slots: string[];
  being_contacted_for_slots: string[];
  preferred_time_window: TimeWindow;

  // Soft-scoring inputs
  has_current_appointment: boolean;
  wants_earlier_slot: boolean;
  occupation: Occupation;
  last_minute_accepted: number;
  no_response_count: number;
  cancellation_count: number;
  no_show_count: number;
  waitlist_since: Date;
  visits_last_12_months: number;

  waitlist_status: WaitlistStatus;
  createdAt: Date;
  updatedAt: Date;
}
