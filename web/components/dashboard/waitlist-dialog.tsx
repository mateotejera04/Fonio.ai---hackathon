"use client"

import * as React from "react"
import { ListOrdered } from "lucide-react"

import type { RankedWaitlistPatient } from "@/lib/waitlist"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { WaitlistTable } from "@/components/dashboard/waitlist-table"
import { WaitlistBreakdownDialog } from "@/components/dashboard/waitlist-breakdown-dialog"

interface WaitlistDialogProps {
  patients: RankedWaitlistPatient[]
}

export function WaitlistDialog({ patients }: WaitlistDialogProps) {
  const [selected, setSelected] = React.useState<RankedWaitlistPatient | null>(
    null
  )
  const [breakdownOpen, setBreakdownOpen] = React.useState(false)

  function handleSelect(patient: RankedWaitlistPatient) {
    setSelected(patient)
    setBreakdownOpen(true)
  }

  return (
    <>
      <Dialog>
        <DialogTrigger render={<Button variant="outline" />}>
          <ListOrdered />
          View waitlist
        </DialogTrigger>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="size-4 text-muted-foreground" />
              Waitlist — ranked candidates
            </DialogTitle>
            <DialogDescription>
              Every waitlisted patient, ranked by the scoring engine — highest
              first is the best fit when a slot frees up. Click a patient to see
              why they got their score.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto">
            <WaitlistTable patients={patients} onSelect={handleSelect} />
          </div>
        </DialogContent>
      </Dialog>

      <WaitlistBreakdownDialog
        patient={selected}
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        onBack={() => setBreakdownOpen(false)}
      />
    </>
  )
}
