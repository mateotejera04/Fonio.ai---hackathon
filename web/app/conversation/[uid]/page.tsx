import Link from "next/link"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clock,
  MessagesSquare,
  PhoneIncoming,
  PhoneOutgoing,
} from "lucide-react"
import type { VariantProps } from "class-variance-authority"

import { getCall, counterpartName } from "@/lib/calls"
import { Badge, badgeVariants } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Transcript } from "@/components/conversation/transcript"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const CALL_TYPE_LABEL: Record<string, string> = {
  inbound_cancellation: "Cancellation",
  outbound_confirmation: "Slot offer",
}

const CALL_TYPE_VARIANT: Record<string, BadgeVariant> = {
  inbound_cancellation: "destructive",
  outbound_confirmation: "default",
}

function formatDuration(seconds: number) {
  if (!seconds) return "0s"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function formatTimestamp(iso: string | null) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "EEEE, MMM d · HH:mm")
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ uid: string }>
}) {
  const { uid } = await params
  const call = await getCall(uid)

  if (!call) {
    notFound()
  }

  const name = counterpartName(call)
  const number = call.direction === "outbound" ? call.toNumber : call.fromNumber
  const title = name ?? number ?? "Unknown caller"
  const callTypeLabel = CALL_TYPE_LABEL[call.callType] ?? call.callType
  const callTypeVariant = CALL_TYPE_VARIANT[call.callType] ?? "secondary"
  const started = formatTimestamp(call.startTimestamp)
  const ctx = call.context ?? {}
  const hasAppointmentChange = Boolean(
    ctx.appointment_old_date || ctx.appointment_new_date,
  )
  const messageCount = (call.transcript ?? []).filter(
    (t) => t.role !== "tool",
  ).length

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to overview
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                {call.direction === "outbound" ? (
                  <PhoneOutgoing className="size-5 text-muted-foreground" />
                ) : (
                  <PhoneIncoming className="size-5 text-muted-foreground" />
                )}
                {title}
              </CardTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {started && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-3.5" />
                    {started}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {formatDuration(call.duration)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessagesSquare className="size-3.5" />
                  {messageCount} messages
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={callTypeVariant} className="text-sm">
                {callTypeLabel}
              </Badge>
              <Badge variant="outline" className="text-sm capitalize">
                {call.direction}
              </Badge>
            </div>
          </div>
        </CardHeader>
        {(call.summary || hasAppointmentChange) && (
          <CardContent className="flex flex-col gap-4">
            {call.summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                {call.summary}
              </p>
            )}
            {hasAppointmentChange && (
              <>
                <Separator />
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  {ctx.appointment_old_date && (
                    <span className="text-muted-foreground line-through">
                      {ctx.appointment_old_date} {ctx.appointment_old_time}
                    </span>
                  )}
                  {ctx.appointment_old_date && ctx.appointment_new_date && (
                    <ArrowRight className="size-4 text-muted-foreground" />
                  )}
                  {ctx.appointment_new_date && (
                    <span className="font-medium text-foreground">
                      {ctx.appointment_new_date} {ctx.appointment_new_time}
                      {ctx.appointment_new_type ? ` · ${ctx.appointment_new_type}` : ""}
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="size-4 text-muted-foreground" />
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Transcript
            transcript={call.transcript ?? []}
            userName={name ?? "Patient"}
            disconnectReason={call.disconnectReason}
          />
        </CardContent>
      </Card>
    </div>
  )
}
