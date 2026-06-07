import { TopBar } from "@/components/shell/top-bar"
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar"
import { OverviewRail } from "@/components/shell/overview-rail"
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar"

export const dynamic = "force-dynamic"

const FILTERS = ["All", "Upcoming", "Pending", "Completed", "Missed"]

async function loadEvents(): Promise<CalendarEvent[]> {
  try {
    return await getCalendarEvents()
  } catch {
    return []
  }
}

export default async function CalendarPage() {
  const events = await loadEvents()

  return (
    <>
      <TopBar>
        <div className="hidden items-center gap-1 md:flex">
          {FILTERS.map((f, i) => (
            <span
              key={f}
              className={
                i === 0
                  ? "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background"
                  : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground"
              }
            >
              {f}
            </span>
          ))}
        </div>
      </TopBar>

      <div className="flex flex-1 gap-6 p-6">
        <div className="min-w-0 flex-1">
          <WeeklyCalendar />
        </div>
        <OverviewRail events={events} />
      </div>
    </>
  )
}
