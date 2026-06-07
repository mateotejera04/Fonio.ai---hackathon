"use client"

import type { VariantProps } from "class-variance-authority"
import { ClipboardList, Trophy } from "lucide-react"

import type { RankedWaitlistPatient, WaitlistStatus } from "@/lib/waitlist"
import { formatEuro, treatmentPrice } from "@/lib/waitlist"
import { Badge, badgeVariants } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"]

const STATUS_VARIANT: Record<WaitlistStatus, BadgeVariant> = {
  QUEUED: "secondary",
  CONTACTING: "default",
  ACCEPTED: "default",
  DECLINED: "outline",
  EXPIRED: "outline",
  NEEDS_HUMAN: "destructive",
}

function statusVariant(status: WaitlistStatus): BadgeVariant {
  return STATUS_VARIANT[status] ?? "secondary"
}

function scorePercent(score: number): number {
  return Math.round(score * 100)
}

function scoreVariant(score: number): BadgeVariant {
  if (score >= 0.7) return "default"
  if (score >= 0.45) return "secondary"
  return "outline"
}

interface WaitlistTableProps {
  patients: RankedWaitlistPatient[]
  /** When provided, rows become clickable and call this with the patient. */
  onSelect?: (patient: RankedWaitlistPatient) => void
}

export function WaitlistTable({ patients, onSelect }: WaitlistTableProps) {
  if (patients.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>No one on the waitlist</EmptyTitle>
          <EmptyDescription>
            Patients waiting for an earlier slot will show up here, ranked by
            how good a fit they are for the next freed appointment.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Rank</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Treatment</TableHead>
          <TableHead>Recoverable revenue</TableHead>
          <TableHead>Preferred window</TableHead>
          <TableHead>Days waiting</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => {
          const filtered = !patient.hardFilterPassed
          const isTop = patient.rank === 1

          const clickable = Boolean(onSelect)

          return (
            <TableRow
              key={patient._id}
              onClick={onSelect ? () => onSelect(patient) : undefined}
              className={cn(
                filtered && "text-muted-foreground",
                clickable && "cursor-pointer"
              )}
            >
              <TableCell>
                {filtered ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : isTop ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                    <Trophy className="size-3.5 text-amber-500" />
                    {patient.rank}
                  </span>
                ) : (
                  <span className="font-medium">{patient.rank}</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className={cn("font-medium", filtered && "text-muted-foreground")}>
                    {patient.name}
                  </span>
                  {isTop && (
                    <span className="text-xs text-muted-foreground">
                      Next to be filled
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {patient.phone}
              </TableCell>
              <TableCell>{patient.desired_treatment}</TableCell>
              <TableCell className="font-medium tabular-nums">
                {formatEuro(treatmentPrice(patient.desired_treatment))}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {patient.preferred_time_window}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {patient.daysWaiting}d
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(patient.waitlist_status)}>
                  {patient.waitlist_status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {filtered ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Filtered
                  </Badge>
                ) : (
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${scorePercent(patient.finalScore)}%` }}
                      />
                    </div>
                    <Badge variant={scoreVariant(patient.finalScore)}>
                      {patient.finalScore.toFixed(2)}
                    </Badge>
                  </div>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
