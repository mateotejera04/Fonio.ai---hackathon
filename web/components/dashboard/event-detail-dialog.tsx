"use client"

import { format } from "date-fns"
import { CalendarDays, Clock, Tag, Hourglass } from "lucide-react"

import type { CalendarEvent } from "@/lib/calendar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

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

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-booked/15 text-booked",
  cancelled: "bg-live-muted text-live",
  tentative: "bg-warn/15 text-warn-foreground",
}

export function EventDetailDialog({ event }: { event: CalendarEvent }) {
  const duration = durationLabel(event)
  const status = event.status ?? "confirmed"

  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="block w-full max-w-full text-left"
            title={event.summary}
          />
        }
      >
        <Badge
          variant="outline"
          className="block w-full max-w-full cursor-pointer justify-start truncate px-1.5 text-left font-normal transition-colors hover:bg-muted"
        >
          <span className="truncate">
            {event.isAllDay ? (
              <span className="text-muted-foreground">All day · </span>
            ) : event.start ? (
              <span className="text-muted-foreground">
                {format(new Date(event.start), "HH:mm")} ·{" "}
              </span>
            ) : null}
            {event.summary}
          </span>
        </Badge>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {event.summary}
          </DialogTitle>
          <DialogDescription>Appointment details</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Row icon={<Tag className="size-4" />} label="Status">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                STATUS_STYLE[status] ?? "bg-muted text-muted-foreground"
              )}
            >
              {status}
            </span>
          </Row>

          {event.start && (
            <Row icon={<CalendarDays className="size-4" />} label="Date">
              {format(new Date(event.start), "EEEE, d MMMM yyyy")}
            </Row>
          )}

          {!event.isAllDay && event.start && event.end && (
            <Row icon={<Clock className="size-4" />} label="Time">
              {format(new Date(event.start), "HH:mm")} –{" "}
              {format(new Date(event.end), "HH:mm")}
            </Row>
          )}

          {duration && (
            <Row icon={<Hourglass className="size-4" />} label="Duration">
              {duration}
            </Row>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="w-20 text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-medium">{children}</span>
    </div>
  )
}
