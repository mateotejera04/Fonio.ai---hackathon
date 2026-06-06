# Ranking Engine Specification
## Dental Slot Recovery Agent — START Hack Vienna '26

---

## Overview

When a dental appointment is cancelled, the system frees a slot and must find the best candidate from the waitlist to fill it. The ranking engine scores every waitlist candidate from **0 to 1**. The closer to 1, the more suitable the candidate. Candidates are contacted in descending score order.

There are two stages:
1. **Hard filters** — remove candidates who cannot or should not be contacted
2. **Soft scoring** — score the remaining candidates using weighted variables

---

## Stage 1 — Hard Filters

Remove the candidate from ranking entirely if **any** of the following is true. Do not compute a score for filtered candidates.

| # | Filter | Logic |
|---|---|---|
| 1 | No valid contact consent | `patient.consentCall === false && patient.consentMessage === false` |
| 2 | Treatment type incompatible | `waitlistEntry.desiredTreatmentType !== slot.treatmentType` |
| 3 | Cannot arrive in time | `min(patient.homeDistanceMinutes, patient.workDistanceMinutes) >= minutesUntilSlot` |
| 4 | Already rejected this slot | `contactAttempt exists where slotId === slot.id && patientId === patient.id && status === DECLINED` |
| 5 | Marked as do-not-contact | `patient.doNotContact === true` |
| 6 | Already being contacted for this slot | `contactAttempt exists where slotId === slot.id && patientId === patient.id && status === CALLING or MESSAGE_SENT` |
| 7 | Time window incompatible | `waitlistEntry.preferredTimeWindow` does not include the slot's time of day (see mapping below) |

### Clinic Hours

All appointments are scheduled between **08:00 and 18:00**. Slots outside this range should never exist, but if encountered treat as EXPIRED.

### Time Window Mapping

```
morning   → slot startTime between 08:00 and 11:59
afternoon → slot startTime between 12:00 and 17:59
any       → always passes the filter
```

> Note: There is no `evening` window. The clinic closes at 18:00, so the latest possible slot start is 17:00 (assuming a minimum 60-minute appointment). Any `preferredTimeWindow` value of `evening` stored on a waitlist entry should be treated as incompatible with all slots and the candidate will always be filtered out — flag this as a data issue.

---

## Stage 2 — Patient Type Detection

After filtering, determine which scoring formula to use:

```
if (waitlistEntry.hasAssignedAppointment === true) → use ASSIGNED formula
if (waitlistEntry.hasAssignedAppointment === false) → use UNASSIGNED formula
```

---

## Stage 3 — Individual Variable Scores

Each variable returns a number between 0.0 and 1.0.

---

### 1. Urgency Score

Derived from the **freed slot's treatment type**, not from the patient's self-reported urgency.

```
slot.treatmentType === 'cleaning'              → 0.3
slot.treatmentType === 'checkup'               → 0.6
slot.treatmentType === 'urgent_consultation'   → 1.0
```

---

### 2. Appointment Improvement Score

**Assigned patients only.** Measures how many days earlier the freed slot is compared to the patient's current appointment.

```
daysSaved = daysBetween(today, waitlistEntry.currentAppointmentDate)
          - daysBetween(today, slot.startTime)
```

| Days Saved | Score |
|---|---|
| 0 or negative | 0.0 |
| 1–2 days | 0.2 |
| 3–6 days | 0.5 |
| 7–13 days | 0.8 |
| 14+ days | 1.0 |

> For unassigned patients, this variable is not used and its weight is redistributed.

---

### 3. Proximity Score

Use the best available distance between the patient and the clinic.

```
bestDistance = min(patient.homeDistanceMinutes, patient.workDistanceMinutes)
```

| Minutes | Score |
|---|---|
| 0–10 | 1.0 |
| 11–20 | 0.8 |
| 21–30 | 0.5 |
| 31–45 | 0.3 |
| 45+ | 0.1 |

> This score is further modified by the **Days Until Slot modifier** (see Section 4).

---

### 4. Occupation Flexibility Score

Estimates how likely the candidate is to be available on short notice.

| Occupation | Score |
|---|---|
| student | 0.9 |
| part_time | 0.8 |
| full_time | 0.4 |
| unknown | 0.5 |

---

### 5. Last-Minute Acceptance Score

Rewards candidates who have accepted last-minute slots before.

| History | Score |
|---|---|
| Accepted 3+ last-minute appointments | 1.0 |
| Accepted 2 | 0.8 |
| Accepted 1 | 0.6 |
| No history | 0.4 |
| Often rejected last-minute offers | 0.2 |

Field: `patient.lastMinuteAcceptanceCount`

```
>= 3  → 1.0
=== 2 → 0.8
=== 1 → 0.6
=== 0 → 0.4
< 0   → 0.2  (use a separate flag: patient.frequentlyRejectsLastMinute)
```

---

### 6. No-Response Score

Penalizes candidates who often do not answer.

| No-Response Count | Score |
|---|---|
| 0 | 1.0 |
| 1 | 0.8 |
| 2 | 0.5 |
| 3+ | 0.2 |

Field: `patient.noResponseCount`

---

### 7. Cancellation History Score

Penalizes candidates who frequently cancel appointments.

| Cancellation Count | Score |
|---|---|
| 0 | 1.0 |
| 1 | 0.8 |
| 2 | 0.5 |
| 3+ | 0.2 |

Field: `patient.cancellationCount`

---

### 8. No-Show History Score

Penalizes candidates who didn't show up without cancelling. Weighted more severely than cancellations.

| No-Show Count | Score |
|---|---|
| 0 | 1.0 |
| 1 | 0.7 |
| 2 | 0.4 |
| 3+ | 0.1 |

Field: `patient.noShowCount`

---

### 9. Waitlist Age Score

Adds fairness. Rewards patients who have been waiting longer.

| Days Waiting | Score |
|---|---|
| 30+ days | 1.0 |
| 14–29 days | 0.8 |
| 7–13 days | 0.5 |
| Less than 7 days | 0.3 |

```
daysWaiting = daysBetween(waitlistEntry.createdAt, today)
```

---

### 10. Visit Frequency Score

Rewards patients who are regular visitors to the clinic. Indicates commitment and reliability.

| Visits in last 12 months | Score |
|---|---|
| 4+ visits | 1.0 |
| 2–3 visits | 0.7 |
| 1 visit | 0.4 |
| 0 visits | 0.2 |

Field: `patient.visitsLastTwelveMonths`

---

## Section 4 — Days Until Slot Modifier

This modifier **does not produce its own score**. It multiplies the proximity weight dynamically based on how soon the slot is. The closer the slot, the more proximity matters.

```
hoursUntilSlot = hoursBetween(now, slot.startTime)
```

| Hours Until Slot | Proximity Weight Multiplier |
|---|---|
| Less than 2 hours | 2.5x |
| 2–6 hours | 1.8x |
| 6–24 hours | 1.2x |
| 24–72 hours (1–3 days) | 1.0x *(no change)* |
| 72+ hours (3+ days) | 0.8x |

### How to apply the modifier

The modifier increases the effective weight of proximity and proportionally reduces all other weights so the formula still sums to 1.0.

**Implementation approach:**

```
baseProximityWeight = formula.proximityWeight          // e.g. 0.10
modifiedProximityWeight = baseProximityWeight * multiplier

// Remaining weight to distribute among other variables
remainingWeight = 1.0 - modifiedProximityWeight
originalRemainingWeight = 1.0 - baseProximityWeight

// Scale all other weights proportionally
for each variable v (except proximity):
  v.effectiveWeight = v.baseWeight * (remainingWeight / originalRemainingWeight)
```

---

## Stage 5 — Scoring Formulas

### Assigned Patient Formula

Use when `waitlistEntry.hasAssignedAppointment === true`.

```
score = 0.25 * urgency_score
      + 0.20 * appointment_improvement_score
      + 0.15 * occupation_flexibility_score
      + 0.12 * proximity_score              ← before modifier applied
      + 0.08 * last_minute_acceptance_score
      + 0.07 * waitlist_age_score
      + 0.05 * visit_frequency_score
      + 0.04 * no_response_score
      + 0.03 * cancellation_history_score
      + 0.01 * no_show_score
```

Total base weight = **1.00**

---

### Unassigned Patient Formula

Use when `waitlistEntry.hasAssignedAppointment === false`.

```
score = 0.30 * urgency_score
      + 0.18 * waitlist_age_score
      + 0.15 * occupation_flexibility_score
      + 0.12 * proximity_score              ← before modifier applied
      + 0.08 * last_minute_acceptance_score
      + 0.07 * visit_frequency_score
      + 0.05 * no_response_score
      + 0.03 * cancellation_history_score
      + 0.02 * no_show_score
```

Total base weight = **1.00**

> Note: `appointment_improvement_score` is not used for unassigned patients. Its weight is redistributed to urgency and waitlist age.

---

## Stage 6 — Final Output

The ranking engine returns a sorted array of scored candidates:

```typescript
interface RankedCandidate {
  patientId: string
  waitlistEntryId: string
  patientType: 'assigned' | 'unassigned'
  finalScore: number                  // 0.0 to 1.0
  variableScores: {
    urgency: number
    appointmentImprovement?: number   // only for assigned
    proximity: number
    proximityModifier: number         // the multiplier applied
    occupationFlexibility: number
    lastMinuteAcceptance: number
    noResponse: number
    cancellationHistory: number
    noShowHistory: number
    waitlistAge: number
    visitFrequency: number
  }
  hardFilterPassed: boolean
  filteredReason?: string             // if hardFilterPassed === false
}
```

Candidates are sorted **descending by finalScore**.

Filtered candidates are included in the output with `hardFilterPassed: false` and a `filteredReason` for dashboard visibility, but are never contacted.

---

## Complete Example — Assigned Patient

**Freed slot:**
- Treatment: urgent_consultation
- Start time: tomorrow at 9:00am
- Hours until slot: 20 hours

**Patient: Sarah Miller**
- Has current appointment in 14 days → assigned
- Home distance: 8 min, Work distance: 25 min → bestDistance = 8 min
- Occupation: student
- lastMinuteAcceptanceCount: 3
- noResponseCount: 0
- cancellationCount: 1
- noShowCount: 0
- visitsLastTwelveMonths: 3
- Waitlist age: 10 days
- preferredTimeWindow: morning → slot at 9am ✓ passes hard filter
- consentCall: true ✓ passes hard filter

**Variable scores:**
```
urgency_score                = 1.0   (urgent_consultation)
appointment_improvement_score = 0.8  (14 days saved → 1.0 bracket, but slot is tomorrow so ~13 days saved → 0.8)
proximity_score              = 1.0   (8 min → 0–10 bracket)
occupation_flexibility_score = 0.9   (student)
last_minute_acceptance_score = 1.0   (3+ accepted)
no_response_score            = 1.0   (0 no-responses)
cancellation_history_score   = 0.8   (1 cancellation)
no_show_score                = 1.0   (0 no-shows)
waitlist_age_score           = 0.5   (10 days → 7–13 bracket)
visit_frequency_score        = 0.7   (2–3 visits)
```

**Days until slot modifier:**
```
hoursUntilSlot = 20 → multiplier = 1.2x
modifiedProximityWeight = 0.12 * 1.2 = 0.144
remainingWeight = 1.0 - 0.144 = 0.856
originalRemainingWeight = 1.0 - 0.12 = 0.88
scaleFactor = 0.856 / 0.88 = 0.9727
```

**Final score (assigned formula with modifier applied):**
```
score = (0.25 * 0.9727) * 1.0      → 0.2432
      + (0.20 * 0.9727) * 0.8      → 0.1556
      + (0.15 * 0.9727) * 0.9      → 0.1308
      + 0.144 * 1.0                → 0.1440  ← modified proximity
      + (0.08 * 0.9727) * 1.0      → 0.0778
      + (0.07 * 0.9727) * 0.5      → 0.0340
      + (0.05 * 0.9727) * 0.7      → 0.0340
      + (0.04 * 0.9727) * 1.0      → 0.0389
      + (0.03 * 0.9727) * 0.8      → 0.0233
      + (0.01 * 0.9727) * 1.0      → 0.0097

Final Score ≈ 0.891
```

---

## Error Cases

| Case | Behaviour |
|---|---|
| `hoursUntilSlot <= 0` | Slot is expired → do not rank, mark slot as EXPIRED |
| `slot.startTime` before 08:00 or after 18:00 | Invalid slot → mark as EXPIRED, do not rank |
| `waitlistEntry.preferredTimeWindow === 'evening'` | Always filtered out — no evening slots exist, flag as data issue |
| `bestDistance >= minutesUntilSlot` | Hard filter: cannot arrive in time |
| `waitlistEntry.preferredTimeWindow` is null | Treat as `any`, passes time window filter |
| `patient.visitsLastTwelveMonths` is null | Default to 0 visits → score 0.2 |
| All candidates filtered | Set slot status to NEEDS_HUMAN |
| Score tie between candidates | Prefer the one with higher waitlist age score |

---

## Data Fields Required

All fields the ranking engine reads from the data model:

**From `Patient`:**
- `id`, `homeDistanceMinutes`, `workDistanceMinutes`, `occupationType`
- `consentCall`, `consentMessage`, `doNotContact`
- `lastMinuteAcceptanceCount`, `frequentlyRejectsLastMinute`
- `noResponseCount`, `cancellationCount`, `noShowCount`
- `visitsLastTwelveMonths`

**From `WaitlistEntry`:**
- `id`, `patientId`, `desiredTreatmentType`, `preferredTimeWindow`
- `hasAssignedAppointment`, `currentAppointmentDate`, `createdAt`

**From `AppointmentSlot`:**
- `id`, `treatmentType`, `startTime`

**From `ContactAttempt`:**
- `patientId`, `slotId`, `status` (to check for prior declines or active contacts)