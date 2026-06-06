import { addDays, format, isSameDay, isSameMonth, isToday, startOfWeek } from "date-fns"
import { CalendarX2 } from "lucide-react"

import type { CalendarEvent } from "@/lib/calendar"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const MAX_VISIBLE_EVENTS = 3

interface MonthGridProps {
  events: CalendarEvent[]
}

export function MonthGrid({ events }: MonthGridProps) {
  const today = new Date()
  const gridStart = startOfWeek(today, { weekStartsOn: 1 })
  const days = Array.from({ length: 28 }, (_, i) => addDays(gridStart, i))

  if (events.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarX2 />
          </EmptyMedia>
          <EmptyTitle>No upcoming events</EmptyTitle>
          <EmptyDescription>
            We couldn&apos;t find any calendar events for the next 4 weeks.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <MonthSkeletonGrid days={days} today={today} />
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((event) => {
            if (!event.start) return false
            return isSameDay(new Date(event.start), day)
          })
          return (
            <DayCell
              key={day.toISOString()}
              day={day}
              today={today}
              events={dayEvents}
            />
          )
        })}
      </div>
    </div>
  )
}

function MonthSkeletonGrid({ days, today }: { days: Date[]; today: Date }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => (
          <DayCell key={day.toISOString()} day={day} today={today} events={[]} />
        ))}
      </div>
    </div>
  )
}

function DayCell({
  day,
  today,
  events,
}: {
  day: Date
  today: Date
  events: CalendarEvent[]
}) {
  const isCurrentDay = isToday(day)
  const isCurrentMonth = isSameMonth(day, today)
  const visibleEvents = events.slice(0, MAX_VISIBLE_EVENTS)
  const hiddenCount = events.length - visibleEvents.length

  return (
    <div
      className={cn(
        "flex min-h-28 flex-col gap-1 border-b border-r p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
        !isCurrentMonth && "bg-muted/20"
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-medium",
            isCurrentDay
              ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
              : isCurrentMonth
                ? "text-foreground"
                : "text-muted-foreground"
          )}
        >
          {format(day, "d")}
        </span>
      </div>
      <div className="flex flex-col gap-1 overflow-hidden">
        {visibleEvents.map((event) => (
          <Badge
            key={event.id}
            variant="outline"
            className="block w-full max-w-full justify-start truncate px-1.5 text-left font-normal"
            title={event.summary}
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
        ))}
        {hiddenCount > 0 && (
          <span className="px-1.5 text-xs text-muted-foreground">
            +{hiddenCount} more
          </span>
        )}
      </div>
    </div>
  )
}
