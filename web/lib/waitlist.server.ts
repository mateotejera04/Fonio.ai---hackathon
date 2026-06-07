import { getDb } from "./mongo"
import {
  applyHardFilters,
  scoreWaitlistPatient,
  type RankedWaitlistPatient,
  type WaitlistPatient,
} from "./waitlist"

// JSON round-trip strips BSON/Date types into plain serializable values
// (Dates -> ISO strings) so results are safe to pass to client components.
function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T
}

// ---- Data access ----
//
// Kept out of ./waitlist so its `mongodb` dependency never reaches the client
// bundle. Client components value-import pure helpers from ./waitlist, which
// must stay free of any Node-only imports (this one pulls in `child_process`).

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
