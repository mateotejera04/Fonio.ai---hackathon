import { NextResponse } from "next/server"

import { getCalendarEvents } from "@/lib/calendar"

export const dynamic = "force-dynamic"

// GET /api/calendar?from=ISO&to=ISO -> calendar events in range
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  try {
    const events = await getCalendarEvents({ timeMin: from, timeMax: to })
    return NextResponse.json({ events })
  } catch (err) {
    console.error("[api/calendar] error:", err)
    return NextResponse.json({ events: [], error: String(err) }, { status: 500 })
  }
}
