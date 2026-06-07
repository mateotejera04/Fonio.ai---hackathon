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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Real metrics from Google Calendar. We don't track check-in / completion /
// no-show status, so those are shown as 0 (honest — the source has no such data).
export function OverviewRail({ events }: { events: CalendarEvent[] }) {
  const now = new Date()
  const timed = events.filter(
    (e) => e.start && !e.isAllDay && e.status !== "cancelled"
  )

  const todayCount = timed.filter((e) => isSameDay(new Date(e.start as string), now))
    .length

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
      value: todayCount,
      icon: CalendarDays,
      tint: "bg-primary/10 text-primary",
    },
    { label: "Completed", value: 0, icon: CircleCheck, tint: "bg-emerald-100 text-emerald-600" },
    { label: "Pending Check-ins", value: 0, icon: Clock, tint: "bg-amber-100 text-amber-600" },
    { label: "No-shows", value: 0, icon: CircleX, tint: "bg-red-100 text-red-600" },
  ]

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck2 className="size-4 text-muted-foreground" />
          Today&apos;s Overview
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {now.toLocaleDateString(undefined, {
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
