'use client'

import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { RevenueBreakdown, RevenueChartData, RevenuePoint } from '@/lib/dashboard/types'
import { formatEUR } from '@/lib/utils'

export type { RevenuePoint }

const SERIES_LABEL: Record<string, string> = {
  current: 'Año actual',
  previous: 'Año anterior',
}

const BREAKDOWN_PALETTE = ['#16a34a', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']
const OTHERS_COLOR = 'var(--muted-foreground)'

type RevenueView = 'total' | 'project' | 'lead'

const VIEW_OPTIONS: Array<{ value: RevenueView; label: string }> = [
  { value: 'total', label: 'Total' },
  { value: 'project', label: 'Por proyecto' },
  { value: 'lead', label: 'Por lead' },
]

export function RevenueChart({ data }: { data: RevenueChartData }) {
  // ResponsiveContainer reads DOM dimensions — skip SSR to prevent hydration mismatch.
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<RevenueView>('total')
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-56 w-full" />

  const breakdown: RevenueBreakdown | null =
    view === 'project' ? data.byProject : view === 'lead' ? data.byLead : null
  const seriesLabels = new Map(breakdown?.series.map((series) => [series.key, series.label]))

  return (
    <div className="flex flex-col gap-3">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={breakdown?.points ?? data.totals} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
              width={40}
            />
            <Tooltip
              cursor={{ fill: 'color-mix(in oklab, var(--muted) 60%, transparent)' }}
              contentStyle={{
                background: 'var(--background)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number, name) => [
                formatEUR(value),
                breakdown ? (seriesLabels.get(String(name)) ?? String(name)) : (SERIES_LABEL[String(name)] ?? String(name)),
              ]}
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
              formatter={(value) =>
                breakdown ? (seriesLabels.get(String(value)) ?? String(value)) : (SERIES_LABEL[String(value)] ?? String(value))
              }
            />
            {breakdown ? (
              breakdown.series.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  stackId="revenue"
                  fill={series.key === 'others' ? OTHERS_COLOR : BREAKDOWN_PALETTE[index % BREAKDOWN_PALETTE.length]}
                  maxBarSize={28}
                />
              ))
            ) : (
              <>
                <Bar
                  dataKey="previous"
                  fill="var(--muted-foreground)"
                  fillOpacity={0.35}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
                <Bar dataKey="current" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="inline-flex w-fit items-center rounded-lg border bg-card p-0.5 text-xs" role="tablist" aria-label="Desglose de ingresos">
        {VIEW_OPTIONS.map((option) => {
          const active = option.value === view
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(option.value)}
              className={
                active
                  ? 'rounded-md bg-foreground px-2.5 py-1 font-medium text-background'
                  : 'rounded-md px-2.5 py-1 font-medium text-muted-foreground hover:text-foreground'
              }
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
