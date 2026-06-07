import { Stethoscope } from "lucide-react"

export const dynamic = "force-dynamic"

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Practice configuration.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="size-5" />
          </span>
          <div>
            <div className="font-medium">The Patient — Dental Practice</div>
            <div className="text-sm text-muted-foreground">
              Single-dentist practice · Vienna
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
