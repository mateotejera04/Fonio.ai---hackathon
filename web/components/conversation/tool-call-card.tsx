import { Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ToolCallCardProps {
  /** e.g. `place_call` */
  name: string
  /** Serializable argument object, rendered as `key: value` pairs. */
  args: Record<string, unknown>
  /** Result line(s) shown below the call, e.g. `{ available: true }` or a status string. */
  result?: string
  /** Tone of the result row — used to color the result text. */
  tone?: "default" | "success" | "destructive" | "muted" | "pending"
  className?: string
}

const TONE_CLASS: Record<NonNullable<ToolCallCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
  pending: "text-amber-600 dark:text-amber-400",
}

function formatArgValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`
  return JSON.stringify(value)
}

export function ToolCallCard({
  name,
  args,
  result,
  tone = "default",
  className,
}: ToolCallCardProps) {
  const argsEntries = Object.entries(args)

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/40 px-3 py-2.5 font-mono text-xs",
        className
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <Badge variant="outline" className="font-sans text-[10px] uppercase tracking-wide">
          tool
        </Badge>
        <span className="truncate text-foreground">
          <span className="font-semibold">{name}</span>
          <span className="text-muted-foreground">
            ({"{"}
            {argsEntries.map(([key, value], i) => (
              <span key={key}>
                {i > 0 && ", "}
                {key}: {formatArgValue(value)}
              </span>
            ))}
            {"}"})
          </span>
        </span>
      </div>
      {result !== undefined && (
        <div className="flex items-start gap-2 pl-5.5">
          <span className="text-muted-foreground">→</span>
          <span className={cn("break-words", TONE_CLASS[tone])}>{result}</span>
        </div>
      )}
    </div>
  )
}
