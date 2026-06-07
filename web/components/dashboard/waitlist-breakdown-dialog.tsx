"use client"

import { ArrowLeft, ShieldAlert } from "lucide-react"

import type { RankedWaitlistPatient } from "@/lib/waitlist"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface WaitlistBreakdownDialogProps {
  patient: RankedWaitlistPatient | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when the user wants to go back to the waitlist list. */
  onBack?: () => void
}

function fmt(n: number): string {
  return n.toFixed(2)
}

export function WaitlistBreakdownDialog({
  patient,
  open,
  onOpenChange,
  onBack,
}: WaitlistBreakdownDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {patient && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onBack}
                    aria-label="Back to waitlist"
                  >
                    <ArrowLeft />
                  </Button>
                )}
                <DialogTitle className="flex items-center gap-2">
                  {patient.name}
                  <Badge variant="secondary" className="capitalize">
                    {patient.patientType}
                  </Badge>
                </DialogTitle>
              </div>
              <DialogDescription>
                Why this patient scored{" "}
                <span className="font-medium text-foreground">
                  {fmt(patient.finalScore)}
                </span>
                {patient.rank
                  ? ` — currently ranked #${patient.rank}.`
                  : "."}{" "}
                Each row is weight × score; the weights come from the{" "}
                {patient.patientType} patient formula.
              </DialogDescription>
            </DialogHeader>

            {!patient.hardFilterPassed && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Filtered out and never contacted:{" "}
                  {patient.filteredReason ?? "did not pass hard filters"}. The
                  score below is shown for transparency only.
                </span>
              </div>
            )}

            <div className="max-h-[55vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factor</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Weight</TableHead>
                    <TableHead className="text-right">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patient.contributions.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.detail}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmt(c.score)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {Math.round(c.weight * 100)}%
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmt(c.contribution)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="font-medium">Final score</span>
              <Badge>{fmt(patient.finalScore)}</Badge>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
