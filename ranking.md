# Ranking Engine Specification
## Dental Slot Recovery Agent — START Hack Vienna '26

---

## Overview

When a dental appointment is cancelled, the system frees a slot and must find the best candidate from the waitlist to fill it. The ranking engine scores every waitlist candidate from **0 to 1**. The closer to 1, the more suitable the candidate. Candidates are contacted in descending score order.

There are two stages:
1. **Hard filters** — remove candidates who cannot or should not be contacted
2. **Soft scoring** — score the remaining candidates using weighted variables

---

## Data Fields

All fields come from the CSV. Field names below match the CSV columns exactly.

**Identity**
- `patient_id`, `waitlist_id`, `name`, `phone`

**Hard filter inputs**
- `consent_call` — Yes / No
- `consent_message` — Yes / No
- `consent_channels` — Call, Message, or None (derived display)
- `desired_treatment` — Cleaning | Checkup | Pain
- `home_distance_min` — integer, minutes from home to clinic
- `work_distance_min` — integer, minutes from work to clinic
- `already_rejected_slots` — slot IDs or None
- `being_contacted_for_slots` — slot IDs or None
- `preferred_time_window` — Morning | Afternoon | Any time

**Soft variable inputs**
- `has_current_appointment` — Yes / No
- `wants_earlier_slot` — Yes / No
- `occupation` — Student | Part-time worker | Full-time worker | Unknown
- `last_minute_accepted` — integer (count of accepted last-minute slots)
- `no_response_count` — integer
- `cancellation_count` — integer
- `no_show_count` — integer
- `waitlist_since` — date (YYYY-MM-DD)
- `visits_last_12_months` — integer

**Status**
- `waitlist_status` — QUEUED | CONTACTING | ACCEPTED | DECLINED | EXPIRED

---

## Stage 1 — Hard Filters

Remove the candidate from ranking entirely if **any** of the following is true. Do not compute a score for filtered candidates.

| # | Filter | CSV Field | Logic |
|---|---|---|---|
| 1 | No valid contact consent | `consent_call`, `consent_message` | Both are No |
| 2 | Treatment type incompatible | `desired_treatment` | Does not match the freed slot's treatment type |
| 3 | Cannot arrive in time | `home_distance_min`, `work_distance_min` | `min(home, work) >= minutesUntilSlot` |
| 4 | Already rejected this slot | `already_rejected_slots` | Contains the freed slot ID |
| 5 | Already being contacted for this slot | `being_contacted_for_slots` | Contains the freed slot ID |
| 6 | Time window incompatible | `preferred_time_window` | Slot time does not fall in the patient's preferred window |

### Clinic Hours

All appointments are scheduled between **08:00 and 18:00**.

### Time Window Mapping

```
Morning   → slot startTime between 08:00 and 11:59
Afternoon → slot startTime between 12:00 and 17:59
Any time  → always passes the filter
```

### Treatment Type Mapping

```
CSV value "Cleaning" → matches slot treatmentType: cleaning
CSV value "Checkup"  → matches slot treatmentType: checkup
CSV value "Cavity"   → matches slot treatmentType: urgent_consultation
```

---

## Stage 2 — Patient Type Detection

After filtering, determine which scoring formula to use:

```
if has_current_appointment === "Yes" → use ASSIGNED formula
if has_current_appointment === "No"  → use UNASSIGNED formula
```

The two formulas use the same variables but different weights. Assigned patients already hold an appointment and are only worth moving for a clearly better slot, so the assigned formula leans harder on urgency and proximity. Unassigned patients have nothing booked, so fairness (waitlist age) carries more weight.

---

## Stage 3 — Individual Variable Scores

Each variable returns a number between 0.0 and 1.0.

---

### 1. Urgency Score

Derived from the **freed slot's treatment type**, not from any patient field.

```
slot treatment = Cleaning  → 0.3
slot treatment = Checkup   → 0.6
slot treatment = Cavity    → 1.0
```

---

### 2. Proximity Score

Use the best available distance.

```
bestDistance = min(home_distance_min, work_distance_min)
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

### 3. Occupation Flexibility Score

Estimates how likely the candidate is available on short notice.

| `occupation` value | Score |
|---|---|
| Student | 0.9 |
| Part-time worker | 0.8 |
| Full-time worker | 0.4 |
| Unknown | 0.5 |

---

### 4. Last-Minute Acceptance Score

Rewards candidates who have accepted last-minute slots before.

| `last_minute_accepted` value | Score |
|---|---|
| 3 or more | 1.0 |
| 2 | 0.8 |
| 1 | 0.6 |
| 0 | 0.4 |

---

### 5. No-Response Score

Penalizes candidates who often do not answer.

| `no_response_count` value | Score |
|---|---|
| 0 | 1.0 |
| 1 | 0.8 |
| 2 | 0.5 |
| 3 or more | 0.2 |

---

### 6. Cancellation History Score

Penalizes candidates who frequently cancel.

| `cancellation_count` value | Score |
|---|---|
| 0 | 1.0 |
| 1 | 0.8 |
| 2 | 0.5 |
| 3 or more | 0.2 |

---

### 7. No-Show History Score

Penalizes candidates who did not show up without cancelling. Weighted more severely than cancellations.

| `no_show_count` value | Score |
|---|---|
| 0 | 1.0 |
| 1 | 0.7 |
| 2 | 0.4 |
| 3 or more | 0.1 |

---

### 8. Waitlist Age Score

Adds fairness. Rewards patients who have been waiting longer.

```
daysWaiting = daysBetween(waitlist_since, today)
```

| Days Waiting | Score |
|---|---|
| 30+ days | 1.0 |
| 14–29 days | 0.8 |
| 7–13 days | 0.5 |
| Less than 7 days | 0.3 |

---

### 9. Visit Frequency Score

Rewards regular clinic visitors.

| `visits_last_12_months` value | Score |
|---|---|
| 4 or more | 1.0 |
| 2–3 | 0.7 |
| 1 | 0.4 |
| 0 | 0.2 |

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

```
baseProximityWeight     = formula.proximityWeight       // 0.15 assigned / 0.12 unassigned
modifiedProximityWeight = baseProximityWeight * multiplier

remainingWeight         = 1.0 - modifiedProximityWeight
originalRemainingWeight = 1.0 - baseProximityWeight

// Scale all other weights proportionally so formula still sums to 1.0
for each variable v (except proximity):
  v.effectiveWeight = v.baseWeight * (remainingWeight / originalRemainingWeight)
```

---

## Stage 5 — Scoring Formulas

### Assigned Patient Formula

Use when `has_current_appointment === "Yes"`.

```
score = 0.31 * urgency_score
      + 0.19 * occupation_flexibility_score
      + 0.15 * proximity_score              ← before modifier applied
      + 0.10 * last_minute_acceptance_score
      + 0.09 * waitlist_age_score
      + 0.06 * visit_frequency_score
      + 0.05 * no_response_score
      + 0.04 * cancellation_history_score
      + 0.01 * no_show_score
```

Total base weight = **1.00**

> Previously this formula carried a `0.20 * appointment_improvement_score` term. That variable was removed; its weight was redistributed proportionally (×1.25) across the remaining variables, so the formula still sums to 1.0.

---

### Unassigned Patient Formula

Use when `has_current_appointment === "No"`.

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

---

## Stage 6 — Final Output

The ranking engine returns a sorted array of scored candidates:

```typescript
interface RankedCandidate {
  patient_id: string
  waitlist_id: string
  name: string
  patientType: 'assigned' | 'unassigned'
  finalScore: number                      // 0.0 to 1.0
  variableScores: {
    urgency: number
    proximity: number
    proximityModifier: number             // multiplier applied
    occupationFlexibility: number
    lastMinuteAcceptance: number
    noResponse: number
    cancellationHistory: number
    noShowHistory: number
    waitlistAge: number
    visitFrequency: number
  }
  hardFilterPassed: boolean
  filteredReason?: string                 // if hardFilterPassed === false
  rank?: number                           // position in sorted list
}
```

Candidates sorted **descending by finalScore**.
Filtered candidates included with `hardFilterPassed: false` for dashboard visibility but never contacted.

---

## Complete Example — Assigned Patient

**Freed slot:** Cavity · tomorrow 09:00 · 20 hours away

**Patient: Sarah Miller** (from CSV)

| CSV Field | Value |
|---|---|
| `has_current_appointment` | Yes |
| `desired_treatment` | Cavity |
| `home_distance_min` | 8 |
| `work_distance_min` | 25 |
| `occupation` | Student |
| `last_minute_accepted` | 3 |
| `no_response_count` | 0 |
| `cancellation_count` | 1 |
| `no_show_count` | 0 |
| `visits_last_12_months` | 3 |
| `waitlist_since` | 2026-05-27 (10 days ago) |
| `preferred_time_window` | Morning → slot at 09:00 ✓ |
| `consent_call` | Yes ✓ |

**Variable scores:**
```
urgency_score                 = 1.0   (Cavity)
proximity_score               = 1.0   (8 min → 0–10)
occupation_flexibility_score  = 0.9   (Student)
last_minute_acceptance_score  = 1.0   (3+)
no_response_score             = 1.0   (0)
cancellation_history_score    = 0.8   (1)
no_show_score                 = 1.0   (0)
waitlist_age_score            = 0.5   (10 days → 7–13)
visit_frequency_score         = 0.7   (3 visits → 2–3)
```

**Days until slot modifier (20 hours → 1.2x, assigned base proximity weight 0.15):**
```
modifiedProximityWeight = 0.15 * 1.2 = 0.18
scaleFactor = (1.0 - 0.18) / (1.0 - 0.15) = 0.82 / 0.85 = 0.9647
```

**Final score:**
```
(0.31 * 0.9647) * 1.0  → 0.2991
(0.19 * 0.9647) * 0.9  → 0.1650
 0.18            * 1.0  → 0.1800  ← modified proximity
(0.10 * 0.9647) * 1.0  → 0.0965
(0.09 * 0.9647) * 0.5  → 0.0434
(0.06 * 0.9647) * 0.7  → 0.0405
(0.05 * 0.9647) * 1.0  → 0.0482
(0.04 * 0.9647) * 0.8  → 0.0309
(0.01 * 0.9647) * 1.0  → 0.0096

Final Score ≈ 0.913
```

---

## Error Cases

| Case | Behaviour |
|---|---|
| `hoursUntilSlot <= 0` | Slot expired → mark EXPIRED, do not rank |
| `slot.startTime` before 08:00 or after 18:00 | Invalid slot → mark EXPIRED |
| `preferred_time_window` is null | Treat as Any time, passes filter |
| `visits_last_12_months` is null | Default to 0 → score 0.2 |
| All candidates filtered | Set slot status to NEEDS_HUMAN |
| Score tie | Prefer candidate with higher `waitlist_age_score` |