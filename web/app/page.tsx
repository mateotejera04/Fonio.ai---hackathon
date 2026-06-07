import { Activity, CalendarDays } from "lucide-react"

import { ConversationList } from "@/components/dashboard/conversation-list"
import { MonthGrid } from "@/components/dashboard/month-grid"
import { WaitlistDialog } from "@/components/dashboard/waitlist-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar"
import { getCalls, type CallSummary } from "@/lib/calls"
import type { RankedWaitlistPatient } from "@/lib/waitlist"
import { getRankedWaitlist } from "@/lib/waitlist.server"

// Always render at request time so the dashboard reflects live data instead of
// being prerendered (with empty data) at build time when the DB is unreachable.
export const dynamic = "force-dynamic"

async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    return await getCalendarEvents()
  } catch {
    return []
  }
}

async function loadCalls(): Promise<CallSummary[]> {
  try {
    return await getCalls()
  } catch {
    return []
  }
}

async function loadWaitlist(): Promise<RankedWaitlistPatient[]> {
  try {
    return await getRankedWaitlist()
  } catch {
    return []
  }
}

export default async function Home() {
  const [events, calls, waitlist] = await Promise.all([
    loadCalendarEvents(),
    loadCalls(),
    loadWaitlist(),
  ])

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <header className="mb-10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Clinic dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              A look at your upcoming schedule and the conversations currently
              working to fill open slots.
            </p>
          </div>
        </div>
        <WaitlistDialog patients={waitlist} />
      </header>

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" />
                Next 4 weeks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MonthGrid events={events} />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                Recent conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConversationList calls={calls} />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
