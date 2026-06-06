import { Bot, PhoneOff, User } from "lucide-react"

import type { TranscriptEntry } from "@/lib/calls"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ToolCallCard } from "@/components/conversation/tool-call-card"
import { cn } from "@/lib/utils"

type RenderItem =
  | { kind: "message"; role: "user" | "agent"; content: string; ts: number }
  | {
      kind: "tool"
      name: string
      args: Record<string, unknown>
      result?: string
      tone: "default" | "success" | "destructive" | "muted"
      ts: number
    }

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00"
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function parseToolLine(content: string): {
  label: string
  phase: "exec" | "done" | "other"
  payload: string
} {
  const match = content.match(
    /^\[(.+?)\]\s*(Executing with parameters:|Execution completed:)\s*([\s\S]*)$/,
  )
  if (!match) return { label: "tool", phase: "other", payload: content }
  const phase = match[2].startsWith("Executing") ? "exec" : "done"
  return { label: match[1], phase, payload: match[3].trim() }
}

function shortName(label: string) {
  const parts = label.split(": ")
  return (parts[parts.length - 1] || label).trim()
}

function parseArgs(payload: string): Record<string, unknown> {
  if (!payload || !payload.startsWith("{")) return {}
  try {
    const parsed = JSON.parse(payload)
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

type Tone = "default" | "success" | "destructive" | "muted"

function resultTone(result: string): Tone {
  if (/success|cancelled|canceled|booked|confirmed/i.test(result)) return "success"
  if (/fail|error|unable|not found/i.test(result)) return "destructive"
  return "default"
}

/** Pair up tool "Executing"/"Execution completed" lines and keep dialogue order. */
function buildItems(transcript: TranscriptEntry[]): RenderItem[] {
  const items: RenderItem[] = []
  let pending:
    | { name: string; args: Record<string, unknown>; ts: number }
    | null = null

  const flushPending = () => {
    if (pending) {
      items.push({ kind: "tool", ...pending, tone: "muted" })
      pending = null
    }
  }

  for (const entry of transcript) {
    if (entry.role === "tool") {
      const { label, phase, payload } = parseToolLine(entry.content)
      if (phase === "exec") {
        flushPending()
        pending = {
          name: shortName(label),
          args: parseArgs(payload),
          ts: entry.timestampSecond,
        }
      } else if (phase === "done") {
        if (pending) {
          items.push({
            kind: "tool",
            name: pending.name,
            args: pending.args,
            result: payload,
            tone: resultTone(payload),
            ts: pending.ts,
          })
          pending = null
        } else {
          items.push({
            kind: "tool",
            name: shortName(label),
            args: {},
            result: payload,
            tone: resultTone(payload),
            ts: entry.timestampSecond,
          })
        }
      } else {
        flushPending()
        items.push({
          kind: "tool",
          name: "tool",
          args: {},
          result: payload,
          tone: "muted",
          ts: entry.timestampSecond,
        })
      }
      continue
    }

    flushPending()
    items.push({
      kind: "message",
      role: entry.role === "user" ? "user" : "agent",
      content: entry.content,
      ts: entry.timestampSecond,
    })
  }

  flushPending()
  return items
}

interface TranscriptProps {
  transcript: TranscriptEntry[]
  agentName?: string
  userName?: string
  disconnectReason?: string | null
}

export function Transcript({
  transcript,
  agentName = "Alfred",
  userName = "Patient",
  disconnectReason,
}: TranscriptProps) {
  if (!transcript || transcript.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PhoneOff />
          </EmptyMedia>
          <EmptyTitle>No transcript</EmptyTitle>
          <EmptyDescription>
            This call has no recorded conversation
            {disconnectReason ? ` (${disconnectReason.replace(/_/g, " ")})` : ""}.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const items = buildItems(transcript)

  return (
    <div className="flex flex-col gap-4">
      {items.map((item, i) => {
        if (item.kind === "tool") {
          return (
            <div key={i} className="px-1 sm:px-10">
              <ToolCallCard
                name={item.name}
                args={item.args}
                result={item.result}
                tone={item.tone}
              />
            </div>
          )
        }

        const isUser = item.role === "user"
        return (
          <div
            key={i}
            className={cn(
              "flex items-start gap-3",
              isUser && "flex-row-reverse",
            )}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback
                className={cn(
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
              </AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "flex max-w-[80%] flex-col gap-1",
                isUser && "items-end",
              )}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {isUser ? userName : agentName}
                </span>
                <span className="tabular-nums">{formatClock(item.ts)}</span>
              </div>
              <div
                className={cn(
                  "whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm",
                  isUser
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm bg-muted text-foreground",
                )}
              >
                {item.content}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
