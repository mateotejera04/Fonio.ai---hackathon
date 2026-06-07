import { TopBar } from "@/components/shell/top-bar"
import { WeeklyCalendar } from "@/components/calendar/weekly-calendar"
import { OverviewRail } from "@/components/shell/overview-rail"
import { getCalendarEvents, type CalendarEvent } from "@/lib/calendar"

export const dynamic = "force-dynamic"

const OVERVIEW_WEEK_START = new Date(2026, 5, 8)
const OVERVIEW_WEEK_END = new Date(2026, 5, 14, 23, 59, 59, 999)
const OVERVIEW_WEEK_LABEL = "June 8-14, 2026"

async function loadEvents(): Promise<CalendarEvent[]> {
  try {
    return await getCalendarEvents()
  } catch {
    return []
  }
}

async function loadOverviewWeekEvents(): Promise<CalendarEvent[]> {
  try {
    return await getCalendarEvents({
      timeMin: OVERVIEW_WEEK_START.toISOString(),
      timeMax: OVERVIEW_WEEK_END.toISOString(),
    })
  } catch {
    return []
  }
}

export default async function CalendarPage() {
  const [events, overviewWeekEvents] = await Promise.all([
    loadEvents(),
    loadOverviewWeekEvents(),
  ])

  return (
    <>
      <TopBar />

      <div className="flex flex-1 gap-6 p-6">
        <div className="min-w-0 flex-1">
          <WeeklyCalendar />
        </div>
        <OverviewRail
          events={events}
          overviewEvents={overviewWeekEvents}
          overviewTitle="Week Overview"
          overviewDateLabel={OVERVIEW_WEEK_LABEL}
        />
      </div>
    </>
  )
}
