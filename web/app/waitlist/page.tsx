import { ListOrdered } from "lucide-react"

import { WaitlistTable } from "@/components/dashboard/waitlist-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getRankedWaitlist, type RankedWaitlistPatient } from "@/lib/waitlist"

async function loadWaitlist(): Promise<RankedWaitlistPatient[]> {
  try {
    return await getRankedWaitlist()
  } catch {
    return []
  }
}

export default async function WaitlistPage() {
  const patients = await loadWaitlist()

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-10 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <ListOrdered className="size-5" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Waitlist
          </h1>
          <p className="text-sm text-muted-foreground">
            Every waitlisted patient, ranked by the scoring engine — highest
            score first is the best fit to call when a slot frees up.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrdered className="size-4 text-muted-foreground" />
            Ranked candidates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WaitlistTable patients={patients} />
        </CardContent>
      </Card>
    </div>
  )
}
