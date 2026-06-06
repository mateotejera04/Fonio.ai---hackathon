import path from "path"
import { google } from "googleapis"
import { CalendarIcon, ClockIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CalendarEvent {
  id: string
  summary: string
  start: string | null
  end: string | null
  isAllDay: boolean
}

async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const keyPath = path.resolve(process.cwd(), "../.alfred.iam.json")

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  })

  const calendar = google.calendar({ version: "v3", auth })

  const now = new Date().toISOString()

  const response = await calendar.events.list({
    calendarId: "scheer28philipp@gmail.com",
    timeMin: now,
    maxResults: 20,
    singleEvents: true,
    orderBy: "startTime",
  })

  const items = response.data.items ?? []

  return items.map((event) => {
    const isAllDay = Boolean(event.start?.date && !event.start?.dateTime)
    return {
      id: event.id ?? crypto.randomUUID(),
      summary: event.summary ?? "(No title)",
      start: event.start?.dateTime ?? event.start?.date ?? null,
      end: event.end?.dateTime ?? event.end?.date ?? null,
      isAllDay,
    }
  })
}

function formatEventTime(event: CalendarEvent): string {
  if (!event.start) return "No date"

  if (event.isAllDay) {
    const date = new Date(event.start)
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const start = new Date(event.start)
  const dateStr = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  const startTime = start.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  if (!event.end) return `${dateStr} · ${startTime}`

  const end = new Date(event.end)
  const endTime = end.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${dateStr} · ${startTime} – ${endTime}`
}

function formatDuration(event: CalendarEvent): string | null {
  if (event.isAllDay || !event.start || !event.end) return null

  const start = new Date(event.start)
  const end = new Date(event.end)
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.round(diffMs / 60000)

  if (diffMins < 60) return `${diffMins}m`
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`
}

export default async function CalendarPage() {
  let events: CalendarEvent[] = []
  let error: string | null = null

  try {
    events = await getCalendarEvents()
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load calendar events"
  }

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Upcoming Events
            </h1>
            <p className="text-sm text-muted-foreground">
              Next {events.length} events from your Google Calendar
            </p>
          </div>
        </div>

        {error ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">
                Failed to load events
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">No upcoming events found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {events.map((event) => {
              const duration = formatDuration(event)
              return (
                <Card key={event.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="text-base leading-snug">
                        {event.summary}
                      </CardTitle>
                      {event.isAllDay && (
                        <Badge variant="secondary" className="shrink-0">
                          All day
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {formatEventTime(event)}
                        {duration && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <ClockIcon className="h-3.5 w-3.5" />
                            {duration}
                          </>
                        )}
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
