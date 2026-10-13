'use client'

import type { ECharts, EChartsOption } from 'echarts'
import { useTheme } from 'next-themes'
import { useEffect, useMemo, useRef } from 'react'

import { formatGoalValue, GOAL_LABELS } from '@/lib/dashboard/goals'
import type { GoalMetric } from '@/lib/dashboard/types'

export type GoalHistoryPoint = {
  month: string // YYYY-MM
  actual: number
  target: number | null
  current: boolean
  /** Value the month should have reached by today to be on pace (current month only). */
  expected?: number | null
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const monthLabel = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? key

function MetricChart({
  metric,
  points,
  dark,
}: {
  metric: GoalMetric
  points: GoalHistoryPoint[]
  dark: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)

  const option = useMemo<EChartsOption>(() => {
    const muted = dark ? '#b5b5b5' : '#737373'
    const border = dark ? '#5a5a5a' : '#d4d4d4'
    const neutral = dark ? '#8a8a8a' : '#a3a3a3'
    const ok = dark ? '#22c55e' : '#16a34a'
    const bad = dark ? '#ef4444' : '#dc2626'
    const info = dark ? '#3b82f6' : '#2563eb'
    const pace = dark ? '#fafafa' : '#171717'
    let bestIndex = -1
    points.forEach((p, i) => {
      if (p.current || p.actual <= 0) return
      if (bestIndex < 0 || p.actual > (points[bestIndex]?.actual ?? 0)) bestIndex = i
    })
    return {
      grid: { left: 4, right: 8, top: 14, bottom: 0, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: dark ? '#343434' : '#ffffff',
        borderColor: border,
        textStyle: { color: dark ? '#fafafa' : '#171717', fontSize: 12 },
        formatter: (raw) => {
          const item = (Array.isArray(raw) ? raw[0] : raw) as { dataIndex: number }
          const p = points[item.dataIndex]
          if (!p) return ''
          const lines = [
            `${monthLabel(p.month)} ${p.month.slice(0, 4)}${p.current ? ' (en curso)' : ''}`,
          ]
          lines.push(`Logrado: ${formatGoalValue(metric, p.actual)}`)
          if (p.current && p.expected != null)
            lines.push(`Ritmo esperado hoy: ${formatGoalValue(metric, p.expected)}`)
          if (!p.current && p.actual > 0 && points[bestIndex] === p) lines.push('Mejor mes')
          lines.push(
            p.target === null
              ? 'Sin meta ese mes'
              : `Meta: ${formatGoalValue(metric, p.target)} (${Math.round((p.actual / (p.target || 1)) * 100)}%)`,
          )
          return lines.join('<br/>')
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((p) => monthLabel(p.month)),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: border } },
        axisLabel: { color: muted, fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitNumber: 3,
        splitLine: { lineStyle: { color: border, type: 'dashed' } },
        axisLabel: {
          color: muted,
          fontSize: 10,
          formatter: (v: number) => formatGoalValue(metric, v),
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 26,
          data: points.map((p, i) => ({
            value: p.actual,
            label:
              i === bestIndex
                ? {
                    show: true,
                    position: 'top' as const,
                    color: muted,
                    fontSize: 10,
                    formatter: () => `★ ${formatGoalValue(metric, p.actual)}`,
                  }
                : { show: false },
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              // The current month is still in progress: blue until the goal is reached.
              color: p.current
                ? p.target !== null && p.actual >= p.target
                  ? ok
                  : info
                : p.target === null
                  ? neutral
                  : p.actual >= p.target
                    ? ok
                    : bad,
            },
          })),
        },
        {
          // Where the current month should be today to finish on target.
          type: 'scatter',
          symbol: 'rect',
          symbolSize: [30, 3],
          silent: true,
          itemStyle: { color: pace },
          data: points.map((p) => (p.current && p.expected != null ? p.expected : null)),
        },
        {
          type: 'line',
          step: 'middle',
          symbol: 'none',
          silent: true,
          connectNulls: false,
          lineStyle: { color: muted, width: 1.5, type: 'dashed' },
          data: points.map((p) => p.target),
        },
      ],
    }
  }, [metric, points, dark])

  const optionRef = useRef(option)
  useEffect(() => {
    optionRef.current = option
    chartRef.current?.setOption(option, { notMerge: true })
  }, [option])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let cancelled = false
    let observer: ResizeObserver | undefined
    void import('echarts').then(({ init }) => {
      if (cancelled) return
      const chart = init(el)
      chartRef.current = chart
      chart.setOption(optionRef.current, { notMerge: true })
      observer = new ResizeObserver(() => chart.resize())
      observer.observe(el)
    })
    return () => {
      cancelled = true
      observer?.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  const settled = points.filter((p) => !p.current && p.target !== null)
  const hits = settled.filter((p) => p.actual >= (p.target ?? 0)).length

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{GOAL_LABELS[metric]}</h3>
        <span className="text-xs text-muted-foreground">
          {settled.length > 0 ? `${hits}/${settled.length} meses cumplidos` : 'Sin metas cerradas'}
        </span>
      </div>
      <div
        ref={ref}
        role="img"
        aria-label={`Histórico mensual de ${GOAL_LABELS[metric]}`}
        className="h-44 w-full"
      />
    </div>
  )
}

export function GoalsHistoryChart({
  series,
}: {
  series: Array<{ metric: GoalMetric; points: GoalHistoryPoint[] }>
}) {
  const dark = useTheme().resolvedTheme === 'dark'
  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-2">
        {series.map((s) => (
          <MetricChart key={s.metric} metric={s.metric} points={s.points} dark={dark} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Barras: lo logrado cada mes (verde = meta cumplida, rojo = no cumplida, gris = sin meta,
        azul = mes en curso). Línea discontinua: meta vigente. Marca negra: dónde deberías ir hoy
        para llegar a la meta. ★ mejor mes.
      </p>
    </div>
  )
}
