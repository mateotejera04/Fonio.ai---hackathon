import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import {
  ChevronRight,
  MessageSquareOff,
  MessagesSquare,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
} from "lucide-react"
import type { VariantProps } from "class-variance-authority"

import type { CallSummary } from "@/lib/calls"
import { Badge, badgeVariants } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const CALL_TYPE_LABEL: Record<string, string> = {
  inbound_cancellation: "Cancellation",
  outbound_confirmation: "Slot offer",
}

const CALL_TYPE_VARIANT: Record<string, BadgeVariant> = {
  inbound_cancellation: "destructive",
  outbound_confirmation: "default",
}

function callTypeLabel(callType: string) {
  return CALL_TYPE_LABEL[callType] ?? callType
}

function callTypeVariant(callType: string): BadgeVariant {
  return CALL_TYPE_VARIANT[callType] ?? "secondary"
}

function formatDuration(seconds: number) {
  if (!seconds) return "0s"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

function relativeTime(iso: string | null) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return formatDistanceToNow(date, { addSuffix: true })
}

interface ConversationListProps {
  calls: CallSummary[]
}

export function ConversationList({ calls }: ConversationListProps) {
  if (calls.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareOff />
          </EmptyMedia>
          <EmptyTitle>No conversations yet</EmptyTitle>
          <EmptyDescription>
            Calls handled by the voice agent will show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ItemGroup>
      {calls.map((call) => {
        const title =
          call.counterpartName ?? call.counterpartNumber ?? "Unknown caller"
        const when = relativeTime(call.startTimestamp ?? call.createdAt)
        const DirectionIcon = !call.connected
          ? PhoneMissed
          : call.direction === "outbound"
            ? PhoneOutgoing
            : PhoneIncoming

        return (
          <Item
            key={call._id}
            variant="outline"
            render={<Link href={`/conversation/${call._id}`} />}
          >
            <ItemMedia variant="icon">
              <DirectionIcon
                className={
                  call.connected ? "text-muted-foreground" : "text-destructive"
                }
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle className="flex flex-wrap items-center gap-2">
                {title}
                <Badge variant={callTypeVariant(call.callType)}>
                  {callTypeLabel(call.callType)}
                </Badge>
                {!call.connected && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not connected
                  </Badge>
                )}
              </ItemTitle>
              <ItemDescription className="flex flex-col gap-1">
                <span className="line-clamp-2">
                  {call.summary ?? "No summary available for this call."}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                  <span className="capitalize">{call.direction}</span>
                  <span className="flex items-center gap-1">
                    <MessagesSquare className="size-3" />
                    {call.messageCount} messages
                  </span>
                  <span>{formatDuration(call.duration)}</span>
                  {when && <span>{when}</span>}
                </span>
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ChevronRight className="size-4 text-muted-foreground" />
            </ItemActions>
          </Item>
        )
      })}
    </ItemGroup>
  )
}
