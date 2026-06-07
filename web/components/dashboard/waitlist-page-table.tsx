"use client"

import * as React from "react"

import type { RankedWaitlistPatient } from "@/lib/waitlist"
import { WaitlistBreakdownDialog } from "@/components/dashboard/waitlist-breakdown-dialog"
import { WaitlistTable } from "@/components/dashboard/waitlist-table"

export function WaitlistPageTable({
  patients,
}: {
  patients: RankedWaitlistPatient[]
}) {
  const [selected, setSelected] = React.useState<RankedWaitlistPatient | null>(
    null
  )
  const [open, setOpen] = React.useState(false)

  function handleSelect(patient: RankedWaitlistPatient) {
    setSelected(patient)
    setOpen(true)
  }

  return (
    <>
      <WaitlistTable patients={patients} onSelect={handleSelect} />
      <WaitlistBreakdownDialog
        patient={selected}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
