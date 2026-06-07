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
  const [open, setOpen] = React.useState(false)
  const [livePatients, setLivePatients] =
    React.useState<RankedWaitlistPatient[]>(patients)

  // Keep showing the latest server-rendered data until the dialog opens.
  React.useEffect(() => {
    setLivePatients(patients)
  }, [patients])

  // While the dialog is open, refresh the ranked waitlist every second.
  React.useEffect(() => {
    if (!open) return

    let cancelled = false

    async function refresh() {
      try {
        const res = await fetch("/api/waitlist", { cache: "no-store" })
        if (!res.ok) return
        const data = (await res.json()) as RankedWaitlistPatient[]
        if (!cancelled) setLivePatients(data)
      } catch {
        // Transient fetch errors — keep the last good data and retry next tick.
      }
    }

    refresh()
    const id = setInterval(refresh, 1000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [open])

  function handleSelect(patient: RankedWaitlistPatient) {
    setSelected(patient)
    setBreakdownOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
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
            <WaitlistTable patients={livePatients} onSelect={handleSelect} />
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
