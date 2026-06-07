import Link from "next/link"
import {
  CalendarCheck2,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock,
} from "lucide-react"

import type { CalendarEvent } from "@/lib/calendar"
import { cn } from "@/lib/utils"

interface OverviewRailProps {
  events: CalendarEvent[]
  overviewEvents?: CalendarEvent[]
  overviewTitle?: string
  overviewDateLabel?: string
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isNoShow(event: CalendarEvent): boolean {
  const text = `${event.summary} ${event.status ?? ""}`.toLowerCase()
  return (
    text.includes("no-show") ||
    text.includes("no show") ||
    text.includes("noshow") ||
    text.includes("missed")
  )
}

export function OverviewRail({
  events,
  overviewEvents,
  overviewTitle = "Today's Overview",
  overviewDateLabel,
}: OverviewRailProps) {
  const now = new Date()
  const rangeEvents =
    overviewEvents ??
    events.filter((event) => event.start && isSameDay(new Date(event.start), now))

  const scheduledInRange = rangeEvents.filter(
    (e) => e.start && !e.isAllDay && e.status !== "cancelled"
  )
  const noShowCount = scheduledInRange.filter(isNoShow).length
  const completedCount = scheduledInRange.filter(
    (e) =>
      !isNoShow(e) &&
      e.end &&
      new Date(e.end).getTime() <= now.getTime()
  ).length
  const pendingCount = scheduledInRange.filter(
    (e) =>
      !isNoShow(e) &&
      e.start &&
      new Date(e.start).getTime() > now.getTime()
  ).length

  const timed = events.filter(
    (e) => e.start && !e.isAllDay && e.status !== "cancelled"
  )

  const upcoming = timed
    .filter((e) => new Date(e.start as string).getTime() >= now.getTime())
    .sort(
      (a, b) =>
        new Date(a.start as string).getTime() -
        new Date(b.start as string).getTime()
    )
    .slice(0, 3)

  const stats = [
    {
      label: "Total Appointments",
      value: scheduledInRange.length,
      icon: CalendarDays,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: "Completed",
      value: completedCount,
      icon: CircleCheck,
      tint: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Pending Check-ins",
      value: pendingCount,
      icon: Clock,
      tint: "bg-amber-100 text-amber-600",
    },
    {
      label: "No-shows",
      value: noShowCount,
      icon: CircleX,
      tint: "bg-red-100 text-red-600",
    },
  ]

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck2 className="size-4 text-muted-foreground" />
          {overviewTitle}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {overviewDateLabel ??
            now.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
        </p>
      </div>

      {stats.map((s) => (
        <div
          key={s.label}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
        >
          <span className={cn("grid size-9 place-items-center rounded-lg", s.tint)}>
            <s.icon className="size-[18px]" />
          </span>
          <div>
            <div className="text-2xl font-semibold leading-none">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
          </div>
        </div>
      ))}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Next Appointments</div>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            No upcoming appointments
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((e) => (
              <li key={e.id} className="rounded-lg border border-border p-2.5">
                <div className="truncate text-sm font-medium">
                  {e.patientName ?? e.summary}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.start as string).toLocaleString(undefined, {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">Quick Actions</div>
        <div className="mt-3 flex flex-col gap-2 text-sm font-medium text-primary">
          <Link href="/calendar" className="hover:underline">
            View all appointments
          </Link>
          <Link href="/waitlist" className="hover:underline">
            View patient waitlist
          </Link>
        </div>
      </div>
    </aside>
  )
}
