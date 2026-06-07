"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const TABS = [
  { href: "/calendar", label: "Calendar View" },
  { href: "/pending", label: "Pending Requests" },
]

export function TopBar({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-border bg-card px-6 py-3">
      <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/")
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          )
        })}
      </div>

      {children}

      <Button className="ml-auto gap-2">
        <Plus className="size-4" />
        New Appointment
      </Button>
    </div>
  )
}
