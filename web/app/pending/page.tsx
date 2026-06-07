import { ClipboardClock } from "lucide-react"

import { TopBar } from "@/components/shell/top-bar"
import { OverviewRail } from "@/components/shell/overview-rail"
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar"

export const dynamic = "force-dynamic"

async function loadEvents(): Promise<CalendarEvent[]> {
  try {
    return await getCalendarEvents()
  } catch {
    return []
  }
}

export default async function PendingPage() {
  const events = await loadEvents()

  return (
    <>
      <TopBar />
      <div className="flex flex-1 gap-6 p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-5">
            <h1 className="text-xl font-semibold tracking-tight">
              Pending Appointment Requests
            </h1>
            <p className="text-sm text-muted-foreground">
              Review and manage appointment requests that require approval.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-20 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
              <ClipboardClock className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">No pending requests</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              There are no appointment requests awaiting approval. New requests
              will appear here for the dentist to approve or reject.
            </p>
          </div>
        </div>
        <OverviewRail events={events} />
      </div>
    </>
  )
}
