"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react"

import type { CalendarEvent } from "@/lib/calendar"
import { cn } from "@/lib/utils"

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function startOfWeek(d: Date): Date {
  const out = new Date(d)
  const day = (out.getDay() + 6) % 7 // Mon=0
  out.setDate(out.getDate() - day)
  out.setHours(0, 0, 0, 0)
  return out
}

type Tone = "blue" | "green" | "amber" | "red" | "violet"
const TONE: Record<Tone, string> = {
  blue: "bg-blue-50 border-blue-300 text-blue-950",
  green: "bg-emerald-50 border-emerald-300 text-emerald-950",
  amber: "bg-amber-50 border-amber-300 text-amber-950",
  red: "bg-red-50 border-red-300 text-red-950",
  violet: "bg-violet-50 border-violet-300 text-violet-950",
}
const DOT: Record<Tone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
}

function toneFor(e: CalendarEvent): Tone {
  if (e.status === "cancelled") return "red"
  const s = `${e.appointmentType ?? ""} ${e.summary || ""}`.toLowerCase()
  if (s.includes("clean") || s.includes("hygiene")) return "green"
  if (
    s.includes("pain") ||
    s.includes("cavity") ||
    s.includes("root") ||
    s.includes("filling") ||
    s.includes("urgent") ||
    s.includes("emergency")
  )
    return "amber"
  if (s.includes("check") || s.includes("exam") || s.includes("control")) {
    return "blue"
  }
  return "violet"
}

function durationMin(e: CalendarEvent): number | null {
  if (!e.start || !e.end) return null
  return Math.round(
    (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000
  )
}

// Demo default: open on the week of Mon 8 Jun – Sun 14 Jun 2026.
const DEFAULT_WEEK = new Date(2026, 5, 8)

export function WeeklyCalendar() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(DEFAULT_WEEK))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d
      }),
    [weekStart]
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    const from = weekStart.toISOString()
    const to = new Date(weekStart.getTime() + 7 * 86400000).toISOString()
    fetch(`/api/calendar?from=${from}&to=${to}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setEvents(d.events ?? [])
      })
      .catch(() => alive && setEvents([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [weekStart])

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${days[6].toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`

  // index timed events by "dayIndex-hour"
  const byCell = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      if (!e.start || e.isAllDay) continue
      const start = new Date(e.start)
      const dayIndex = days.findIndex(
        (d) =>
          d.getFullYear() === start.getFullYear() &&
          d.getMonth() === start.getMonth() &&
          d.getDate() === start.getDate()
      )
      if (dayIndex < 0) continue
      const hour = Math.min(17, Math.max(8, start.getHours()))
      const key = `${dayIndex}-${hour}`
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [events, days])

  const today = new Date()
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Weekly Calendar</h2>
          <span className="text-sm text-muted-foreground">{rangeLabel}</span>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}
            className="grid size-8 place-items-center rounded-lg border border-border hover:bg-muted"
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}
            className="grid size-8 place-items-center rounded-lg border border-border hover:bg-muted"
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          {/* header */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border bg-muted/30">
            <div />
            {days.map((d, i) => (
              <div
                key={i}
                className={cn(
                  "border-l border-border px-2 py-2 text-center",
                  isToday(d) && "bg-primary/5"
                )}
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {DAY_LABELS[i]}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    isToday(d) && "text-primary"
                  )}
                >
                  {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
            ))}
          </div>

          {/* rows */}
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-border last:border-b-0"
            >
              <div className="px-2 py-2 text-right text-xs text-muted-foreground">
                {hour > 12 ? hour - 12 : hour}{hour >= 12 ? " PM" : " AM"}
              </div>
              {days.map((_, dayIndex) => {
                const cell = byCell.get(`${dayIndex}-${hour}`) ?? []
                return (
                  <div
                    key={dayIndex}
                    className="min-h-16 space-y-1 border-l border-border p-1"
                  >
                    {cell.map((e) => {
                      const tone = toneFor(e)
                      const dur = durationMin(e)
                      const title = e.patientName ?? e.summary
                      const appointmentType = e.appointmentType ?? "Appointment"
                      return (
                        <div
                          key={e.id}
                          className={cn("rounded-lg border p-1.5 text-xs", TONE[tone])}
                          title={`${title} - ${appointmentType}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={cn("size-1.5 rounded-full", DOT[tone])} />
                            <span className="truncate font-semibold">
                              {title}
                            </span>
                          </div>
                          {dur != null && (
                            <div className="mt-1 flex items-center justify-between gap-1 opacity-75">
                              <span className="flex min-w-0 items-center gap-1">
                                <Clock className="size-3 shrink-0" />
                                {dur} min
                              </span>
                              {e.appointmentType && (
                                <span className="truncate font-medium">
                                  {e.appointmentType}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
