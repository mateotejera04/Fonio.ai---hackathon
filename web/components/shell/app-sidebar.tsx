"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClock,
  CalendarDays,
  ClipboardClock,
  HandCoins,
  LogOut,
  MessagesSquare,
  Settings,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface NavChild {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}
interface NavItem extends NavChild {
  children?: NavChild[]
}

const NAV: NavItem[] = [
  { href: "/", label: "Conversations", icon: MessagesSquare },
  { href: "/dashboard", label: "Dashboard", icon: TrendingUp },
  {
    href: "/calendar",
    label: "Appointments",
    icon: CalendarClock,
    children: [
      { href: "/calendar", label: "Calendar View", icon: CalendarDays },
      { href: "/pending", label: "Pending Requests", icon: ClipboardClock },
    ],
  },
  { href: "/waitlist", label: "Patients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
]

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(href + "/")
}

export function AppSidebar({ recoveredRevenue }: { recoveredRevenue: string }) {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Stethoscope className="size-[18px]" />
        </span>
        <span className="text-lg font-semibold tracking-tight">Dentist 5</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const childActive = item.children?.some((c) => isActive(pathname, c.href))
          return (
            <div key={item.label}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active || childActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="size-[18px]" />
                {item.label}
              </Link>
              {item.children && (active || childActive) && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-sidebar-border pl-3">
                  {item.children.map((c) => {
                    const ca = isActive(pathname, c.href)
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                          ca
                            ? "font-medium text-primary"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <c.icon className="size-4" />
                        {c.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="mb-2 rounded-lg border border-sidebar-border bg-sidebar-accent/45 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <HandCoins className="size-3.5" />
            Total recovered revenue
          </div>
          <div className="mt-1 font-heading text-xl font-semibold tracking-tight tabular-nums text-sidebar-foreground">
            {recoveredRevenue}
          </div>
        </div>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <LogOut className="size-[18px]" />
          Logout
        </button>
      </div>
    </aside>
  )
}
