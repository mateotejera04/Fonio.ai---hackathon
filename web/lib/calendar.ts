import path from "path"
import { google } from "googleapis"

export interface CalendarEvent {
  id: string
  summary: string
  start: string | null
  end: string | null
  isAllDay: boolean
  status?: string | null
}

const CALENDAR_ID = "scheer28philipp@gmail.com"

function getCalendarClient() {
  const keyPath = path.resolve(process.cwd(), "../.alfred.iam.json")
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  })
  return google.calendar({ version: "v3", auth })
}

/**
 * Fetch calendar events between timeMin and timeMax (ISO strings).
 * Defaults to the next 4 weeks starting from now.
 */
export async function getCalendarEvents(opts?: {
  timeMin?: string
  timeMax?: string
  maxResults?: number
}): Promise<CalendarEvent[]> {
  const calendar = getCalendarClient()

  const timeMin = opts?.timeMin ?? new Date().toISOString()
  const timeMax =
    opts?.timeMax ??
    new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString()

  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin,
    timeMax,
    maxResults: opts?.maxResults ?? 250,
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
      status: event.status ?? null,
    }
  })
}
