import path from "path"
import { google } from "googleapis"

export interface CalendarEvent {
  id: string
  summary: string
  patientName: string | null
  start: string | null
  end: string | null
  isAllDay: boolean
  status?: string | null
}

const CALENDAR_ID = "scheer28philipp@gmail.com"

function getCalendarClient() {
  const keyFile =
    process.env.GOOGLE_CALENDAR_KEY_FILE ??
    path.resolve(process.cwd(), "../.alfred.iam.json")
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  })
  return google.calendar({ version: "v3", auth })
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim()
}

function patientNameFromDescription(description?: string | null): string | null {
  if (!description) return null
  const text = stripHtml(description)
  const match = text.match(
    /(?:patient(?:\s+name)?|name|client)\s*[:\-]\s*([^\n\r,;]+)/i
  )
  return match?.[1]?.trim() || null
}

function patientNameFromSummary(summary?: string | null): string | null {
  if (!summary) return null
  const trimmed = summary.trim()
  const generic = /^(appointment|termin|dental appointment)$/i
  if (!generic.test(trimmed)) return trimmed
  return null
}

function getPatientName(event: {
  summary?: string | null
  description?: string | null
  attendees?: { displayName?: string | null; email?: string | null }[] | null
  extendedProperties?: {
    private?: Record<string, string> | null
    shared?: Record<string, string> | null
  } | null
}): string | null {
  const props = {
    ...(event.extendedProperties?.shared ?? {}),
    ...(event.extendedProperties?.private ?? {}),
  }
  const firstName = firstString(props.first_name, props.firstName)
  const lastName = firstString(props.last_name, props.lastName)
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim()

  return (
    firstString(
      props.patientName,
      props.patient_name,
      props.patient,
      props.patient_full_name,
      props.name,
      fullName,
      patientNameFromDescription(event.description),
      event.attendees?.find((attendee) => attendee.displayName?.trim())
        ?.displayName,
      patientNameFromSummary(event.summary)
    ) ?? null
  )
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
      patientName: getPatientName(event),
      start: event.start?.dateTime ?? event.start?.date ?? null,
      end: event.end?.dateTime ?? event.end?.date ?? null,
      isAllDay,
      status: event.status ?? null,
    }
  })
}
