"use client"

import * as React from "react"
import {
  Activity,
  BadgeEuro,
  CalendarCheck2,
  CircleCheck,
  PhoneCall,
  Sparkles,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface Metric {
  label: string
  value: string
  sublabel: string
  delta: string
  icon: React.ComponentType<{ className?: string }>
  spark: number[]
}

interface DashboardData {
  recovered: number
  totalCancellations: number
  revenue: number
  attemptsPerSlot: number
  slotsRecovered: number
  outcomes: { label: string; value: number }[]
  treatments: { label: string; value: number; color: string }[]
  trend: { day: string; slots: number; revenue: number }[]
}

const BASE_DATA: DashboardData = {
  recovered: 9,
  totalCancellations: 12,
  revenue: 870,
  attemptsPerSlot: 2.6,
  slotsRecovered: 9,
  outcomes: [
    { label: "Booked", value: 9 },
    { label: "Declined", value: 6 },
    { label: "No answer", value: 5 },
    { label: "Voicemail", value: 3 },
    { label: "Callback", value: 2 },
  ],
  treatments: [
    { label: "Cleaning", value: 320, color: "#0f9f98" },
    { label: "Checkup", value: 260, color: "#12b886" },
    { label: "Pain", value: 290, color: "#f59e0b" },
  ],
  trend: [
    { day: "Mon", slots: 1, revenue: 90 },
    { day: "Tue", slots: 2, revenue: 170 },
    { day: "Wed", slots: 1, revenue: 110 },
    { day: "Thu", slots: 3, revenue: 260 },
    { day: "Fri", slots: 2, revenue: 170 },
    { day: "Sat", slots: 0, revenue: 0 },
    { day: "Sun", slots: 0, revenue: 0 },
  ],
}

function euro(value: number): string {
  return `€${value.toLocaleString("en-US")}`
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = Math.max(1, max - min)
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 72
      const y = 30 - ((value - min) / range) * 26
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox="0 0 72 32" className="h-8 w-20" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-teal-50 text-teal-700">
            <Icon className="size-4" />
          </span>
          <span className="text-sm text-muted-foreground">{metric.label}</span>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
          {metric.delta}
        </span>
      </div>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-semibold tracking-tight">
            {metric.value}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {metric.sublabel}
          </div>
        </div>
        <div className="text-teal-600">
          <Sparkline values={metric.spark} />
        </div>
      </div>
    </div>
  )
}

function OutcomesChart({ data }: { data: DashboardData["outcomes"] }) {
  const max = Math.max(...data.map((item) => item.value))
  const yTicks = [12, 9, 6, 3, 0]

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="text-sm font-semibold">Outcomes by reason</div>
      <div className="mt-1 text-xs text-muted-foreground">
        25 call attempts this week
      </div>
      <div className="mt-6 grid grid-cols-[32px_1fr] gap-2">
        <div className="flex h-64 flex-col justify-between text-xs text-muted-foreground">
          {yTicks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
        <div className="relative flex h-64 items-end justify-around border-b border-dashed border-border">
          <div className="absolute inset-0 flex flex-col justify-between">
            {yTicks.slice(0, -1).map((tick) => (
              <div key={tick} className="border-t border-dashed border-border" />
            ))}
          </div>
          {data.map((item) => (
            <div key={item.label} className="relative z-10 flex w-20 flex-col items-center gap-2">
              <div
                className="w-12 rounded-t-lg bg-teal-600"
                style={{ height: `${(item.value / max) * 180}px` }}
                title={`${item.label}: ${item.value}`}
              />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DonutChart({ data, total }: { data: DashboardData["treatments"]; total: number }) {
  const totalTreatment = data.reduce((sum, item) => sum + item.value, 0)
  let offset = 25
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="text-sm font-semibold">Revenue by treatment</div>
      <div className="mt-1 text-xs text-muted-foreground">€ recovered</div>
      <div className="mt-8 flex flex-col items-center">
        <div className="relative">
          <svg viewBox="0 0 120 120" className="size-52 -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="18"
            />
            {data.map((item) => {
              const length = (item.value / totalTreatment) * circumference
              const dash = `${length} ${circumference - length}`
              const element = (
                <circle
                  key={item.label}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  strokeWidth="18"
                />
              )
              offset += length
              return element
            })}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
                Total
              </div>
              <div className="text-2xl font-semibold">{euro(total)}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3 text-xs">
          {data.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function TrendChart({ data }: { data: DashboardData["trend"] }) {
  const width = 720
  const height = 220
  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1)
  const points = data.map((item, index) => {
    const x = 32 + index * ((width - 64) / (data.length - 1))
    const y = height - 24 - (item.revenue / maxRevenue) * 150
    return { ...item, x, y }
  })
  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `32,${height - 24} ${line} ${width - 32},${height - 24}`

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-3">
      <div className="text-sm font-semibold">Weekly trend</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Slots recovered and revenue per day
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-6 h-72 w-full">
        {[0, 1, 2, 3].map((lineIndex) => (
          <line
            key={lineIndex}
            x1="32"
            x2={width - 32}
            y1={40 + lineIndex * 45}
            y2={40 + lineIndex * 45}
            stroke="currentColor"
            strokeDasharray="4 4"
            className="text-border"
          />
        ))}
        <polygon points={area} fill="#0f9f98" opacity="0.12" />
        <polyline
          points={line}
          fill="none"
          stroke="#0f9f98"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {points.map((point) => (
          <g key={point.day}>
            <circle cx={point.x} cy={point.y} r="4" fill="#0f9f98" />
            <text
              x={point.x}
              y={height - 2}
              textAnchor="middle"
              className="fill-muted-foreground text-xs"
            >
              {point.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export function PerformanceDashboard() {
  const data = BASE_DATA
  const refillRate = Math.round((data.recovered / data.totalCancellations) * 100)

  const metrics: Metric[] = [
    {
      label: "Refill rate",
      value: `${refillRate}%`,
      sublabel: "vs last week",
      delta: "+8%",
      icon: TrendingUp,
      spark: [3, 5, 6, 4, 3, 6, 5, 6],
    },
    {
      label: "Revenue recovered",
      value: euro(data.revenue),
      sublabel: "vs last week",
      delta: "+€140",
      icon: BadgeEuro,
      spark: [4, 5, 4, 3, 6, 4, 4],
    },
    {
      label: "Attempts / slot",
      value: data.attemptsPerSlot.toFixed(1),
      sublabel: "vs last week",
      delta: "-0.3",
      icon: PhoneCall,
      spark: [5, 5, 4, 4.5, 5, 4.7],
    },
    {
      label: "Slots recovered",
      value: String(data.slotsRecovered),
      sublabel: "vs last week",
      delta: "+2",
      icon: CircleCheck,
      spark: [2, 4, 5, 3, 2, 5, 3, 5],
    },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <header>
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Insights
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Weekly performance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Last 7 days · Praxis Dental 5, Vienna
        </p>
      </header>

      <section className="mt-7 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-700">
            <Sparkles className="size-5" />
          </span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Summary
            </div>
            <p className="mt-2 text-base">
              This week Alfred recovered{" "}
              <span className="font-semibold text-teal-700">
                {data.recovered} of {data.totalCancellations}
              </span>{" "}
              cancellations ({refillRate}%), bringing back{" "}
              <span className="font-semibold text-teal-700">
                {euro(data.revenue)}
              </span>{" "}
              in otherwise-lost revenue.
            </p>
          </div>
          <div className="ml-auto hidden text-right text-xs text-muted-foreground md:block">
            <Activity className="ml-auto mb-1 size-4 text-teal-700" />
            Static mock data
            <br />
            Weekly snapshot
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <OutcomesChart data={data.outcomes} />
        <DonutChart data={data.treatments} total={data.revenue} />
        <TrendChart data={data.trend} />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          { label: "Fastest refill", value: "18 min", icon: CalendarCheck2 },
          { label: "Calls completed", value: "25", icon: PhoneCall },
          { label: "Patient satisfaction", value: "94%", icon: CircleCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-muted text-teal-700">
                <Icon className="size-4" />
              </span>
              <div>
                <div className="text-sm text-muted-foreground">{label}</div>
                <div className={cn("mt-1 text-2xl font-semibold")}>{value}</div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
