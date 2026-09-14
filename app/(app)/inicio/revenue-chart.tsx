'use client'

import Link from 'next/link'
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

import type {
  RevenueBreakdown,
  RevenueChartData,
  RevenueMetricData,
  RevenuePoint,
} from '@/lib/dashboard/types'
import { formatEUR } from '@/lib/utils'

export type { RevenuePoint }

const SERIES_LABEL: Record<string, string> = {
  current: 'Periodo seleccionado',
  previous: 'Periodo anterior',
}

const BREAKDOWN_PALETTE = [
  'var(--success)',
  'var(--info)',
  'var(--warning)',
  'var(--accent)',
  'var(--danger)',
  'var(--primary)',
]
const OTHERS_COLOR = 'var(--muted-foreground)'

type RevenueView = 'total' | 'project' | 'lead'
type RevenueMetric = 'billed' | 'collected'

type RevenueTooltipEntry = {
  dataKey?: string | number
  value?: number | string | null
  color?: string
}

export function filterZeroRevenueTooltipEntries(entries: RevenueTooltipEntry[]) {
  return entries.filter((entry) => Number(entry.value) > 0)
}

function RevenueTooltip({
  active,
  payload,
  label,
  seriesLabels,
  seriesLinks,
  breakdown,
  metricLabel,
  currentTotal,
  previousTotal,
}: {
  active?: boolean
  payload?: RevenueTooltipEntry[]
  label?: string | number
  seriesLabels: Map<string, string>
  seriesLinks: Map<string, string>
  breakdown: boolean
  metricLabel: string
  currentTotal: number
  previousTotal: number
}) {
  if (!active || !payload) return null
  const visibleEntries = filterZeroRevenueTooltipEntries(payload)
  if (visibleEntries.length === 0) return null
  const pointTotal = visibleEntries.reduce((total, entry) => total + Number(entry.value ?? 0), 0)

  return (
    <div className="border-border bg-background rounded-lg border p-2 text-xs shadow-sm">
      <p className="mb-1 font-medium">{label}</p>
      <ul className="flex flex-col gap-1">
        {visibleEntries.map((entry) => {
          const key = String(entry.dataKey)
          const value = Number(entry.value ?? 0)
          const denominator = breakdown
            ? pointTotal
            : key === 'previous'
              ? previousTotal
              : currentTotal
          const percentage = denominator > 0 ? Math.round((value / denominator) * 100) : 0
          const labelContent = seriesLinks.has(key) ? (
            <Link
              className="truncate underline-offset-2 hover:underline"
              href={seriesLinks.get(key) ?? '#'}
            >
              {seriesLabels.get(key) ?? key}
            </Link>
          ) : (
            <span className="truncate">{seriesLabels.get(key) ?? key}</span>
          )
          return (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color ?? 'var(--muted-foreground)' }}
                />
                {labelContent}
              </span>
              <span className="shrink-0 font-medium">
                {formatEUR(value)} <span className="text-muted-foreground">({percentage}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
      <div className="border-border text-muted-foreground mt-2 border-t pt-2">
        {breakdown ? (
          <span>
            Total {metricLabel.toLowerCase()} en el periodo: {formatEUR(currentTotal)}
          </span>
        ) : (
          <span>
            Total seleccionado: {formatEUR(currentTotal)} · anterior: {formatEUR(previousTotal)}
          </span>
        )}
      </div>
    </div>
  )
}

const VIEW_OPTIONS: Array<{ value: RevenueView; label: string }> = [
  { value: 'total', label: 'Total' },
  { value: 'project', label: 'Por proyecto' },
  { value: 'lead', label: 'Por lead' },
]

const METRIC_OPTIONS: Array<{ value: RevenueMetric; label: string }> = [
  { value: 'billed', label: 'Facturación emitida' },
  { value: 'collected', label: 'Cobros recibidos' },
]

function stablePaletteIndex(key: string): number {
  let hash = 0
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % BREAKDOWN_PALETTE.length
}

export function RevenueChart({ data }: { data: RevenueChartData }) {
  // ResponsiveContainer reads DOM dimensions — skip SSR to prevent hydration mismatch.
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<RevenueView>('total')
  const [metric, setMetric] = useState<RevenueMetric>('billed')
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-56 w-full" />

  const metricData: RevenueMetricData = data[metric]
  const breakdown: RevenueBreakdown | null =
    view === 'project' ? metricData.byProject : view === 'lead' ? metricData.byLead : null
  const seriesLabels = new Map(breakdown?.series.map((series) => [series.key, series.label]))
  const seriesLinks = new Map(
    breakdown?.series
      .filter((series) => series.href)
      .map((series) => [series.key, series.href ?? '']) ?? [],
  )
  const currentTotal = metricData.totals.reduce((sum, point) => sum + point.current, 0)
  const previousTotal = metricData.totals.reduce((sum, point) => sum + point.previous, 0)
  const metricLabel = METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? 'Ingresos'

  return (
    <div className="flex flex-col gap-3">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={breakdown?.points ?? metricData.totals}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
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
              content={
                <RevenueTooltip
                  seriesLabels={breakdown ? seriesLabels : new Map(Object.entries(SERIES_LABEL))}
                  seriesLinks={seriesLinks}
                  breakdown={Boolean(breakdown)}
                  metricLabel={metricLabel}
                  currentTotal={currentTotal}
                  previousTotal={previousTotal}
                />
              }
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'var(--muted-foreground)' }}
              formatter={(value) =>
                breakdown
                  ? (seriesLabels.get(String(value)) ?? String(value))
                  : (SERIES_LABEL[String(value)] ?? String(value))
              }
            />
            {breakdown ? (
              breakdown.series.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  stackId="revenue"
                  fill={
                    series.key === 'others'
                      ? OTHERS_COLOR
                      : BREAKDOWN_PALETTE[stablePaletteIndex(series.key)]
                  }
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
                <Bar
                  dataKey="current"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div
        className="bg-card inline-flex w-fit items-center rounded-lg border p-0.5 text-xs"
        role="tablist"
        aria-label="Métrica de ingresos"
      >
        {METRIC_OPTIONS.map((option) => {
          const active = option.value === metric
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMetric(option.value)}
              className={
                active
                  ? 'bg-foreground text-background rounded-md px-2.5 py-1 font-medium'
                  : 'text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 font-medium'
              }
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <div
        className="bg-card inline-flex w-fit items-center rounded-lg border p-0.5 text-xs"
        role="tablist"
        aria-label="Desglose de ingresos"
      >
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
                  ? 'bg-foreground text-background rounded-md px-2.5 py-1 font-medium'
                  : 'text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 font-medium'
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
