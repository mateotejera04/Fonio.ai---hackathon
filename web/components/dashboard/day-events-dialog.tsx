"use client"

import { format } from "date-fns"
import { CalendarDays } from "lucide-react"

import type { CalendarEvent } from "@/lib/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-booked/15 text-booked",
  cancelled: "bg-live-muted text-live",
  tentative: "bg-warn/15 text-warn-foreground",
}

function durationLabel(event: CalendarEvent): string | null {
  if (event.isAllDay) return "All day"
  if (!event.start || !event.end) return null
  const mins = Math.round(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
  )
  if (mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function DayEventsDialog({
  day,
  events,
  trigger,
  children,
}: {
  day: string // ISO
  events: CalendarEvent[]
  trigger: React.ReactElement
  children: React.ReactNode
}) {
  const date = new Date(day)
  const sorted = [...events].sort((a, b) => {
    if (!a.start) return 1
    if (!b.start) return -1
    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })

  return (
    <Dialog>
      <DialogTrigger render={trigger}>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {format(date, "EEEE, d MMMM yyyy")}
          </DialogTitle>
          <DialogDescription>
            {events.length} appointment{events.length === 1 ? "" : "s"} this day
          </DialogDescription>
        </DialogHeader>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <CalendarDays className="size-6 opacity-40" />
            No appointments scheduled.
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 pr-3">
              {sorted.map((event) => {
                const status = event.status ?? "confirmed"
                const duration = durationLabel(event)
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
                  >
                    <div className="tabular w-16 shrink-0 text-sm font-medium text-muted-foreground">
                      {event.isAllDay
                        ? "All day"
                        : event.start
                          ? format(new Date(event.start), "HH:mm")
                          : "--:--"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {event.summary}
                      </div>
                      {duration && !event.isAllDay && (
                        <div className="text-xs text-muted-foreground">
                          {duration}
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                        STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {status}
                    </span>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
