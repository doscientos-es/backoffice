import { Flame } from 'lucide-react'
import Link from 'next/link'

import { GoalsHistoryChartLazy } from '@/components/goals/goals-history-chart-lazy'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  achievedStreak,
  daysInMonth,
  evaluateGoal,
  formatGoalValue,
  GOAL_LABELS,
  GOAL_METRICS,
  type GoalStatus,
  madridToday,
} from '@/lib/dashboard/goals'
import { getGoalMonths } from '@/lib/dashboard/queries'
import type { GoalMetric } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'

const STATUS_COPY: Record<GoalStatus, { label: string; className: string; bar: string }> = {
  no_goal: { label: '', className: '', bar: '' },
  achieved: {
    label: 'Conseguida',
    className: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  missed: { label: 'No alcanzada', className: 'text-destructive', bar: 'bg-destructive' },
  early: { label: 'Mes en marcha', className: 'text-muted-foreground', bar: 'bg-sky-500' },
  on_track: {
    label: 'Buen ritmo',
    className: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  at_risk: {
    label: 'En riesgo',
    className: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500',
  },
  behind: { label: 'Por debajo del ritmo', className: 'text-destructive', bar: 'bg-destructive' },
}

const formatValue = formatGoalValue

function paceText(
  metric: GoalMetric,
  status: GoalStatus,
  projected: number | null,
  neededPerDay: number | null,
) {
  if (status === 'achieved') return '¡Meta cumplida este mes!'
  if (metric === 'conversion_rate') return null
  const parts: string[] = []
  if (projected !== null) parts.push(`Proyección ${formatValue(metric, projected)}`)
  if (neededPerDay !== null && neededPerDay > 0)
    parts.push(`${formatValue(metric, neededPerDay)}/día para llegar`)
  return parts.length ? parts.join(' · ') : null
}

export async function GoalsWidget({ showFinance }: { showFinance: boolean }) {
  const months = await getGoalMonths(13)
  const [currentMonth, ...past] = months
  if (!currentMonth) return null
  const today = madridToday()
  const totalDays = daysInMonth(currentMonth.month)

  const items = GOAL_METRICS.filter((m) => showFinance || m !== 'revenue')
    .map((metric) => {
      const row = currentMonth.rows.find((r) => r.metric === metric)
      if (!row || row.target === null) return null
      const evaluation = evaluateGoal(metric, row.target, row.actual, today.day, totalDays)
      const completed = achievedStreak(past.map((p) => p.rows.find((r) => r.metric === metric)))
      const achieved = evaluation.status === 'achieved'
      return {
        metric,
        row,
        evaluation,
        streak: completed + (achieved ? 1 : 0),
        atStake: completed > 0 && !achieved,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (items.length === 0) return null

  const recent = months.slice(0, 6).reverse()
  const series = items.map(({ metric }) => ({
    metric,
    points: recent.map(({ month, rows }, i) => {
      const r = rows.find((x) => x.metric === metric)
      const current = i === recent.length - 1
      return {
        month,
        actual: r?.actual ?? 0,
        target: r?.target ?? null,
        current,
        expected:
          current && r?.target != null && metric !== 'conversion_rate'
            ? (r.target * today.day) / totalDays
            : null,
      }
    }),
  }))

  // With fewer than 2 closed months that had a goal there is nothing to compare yet,
  // so show a plain summary of past results instead of mostly-empty charts.
  const closedWithGoal = Math.max(
    ...series.map((s) => s.points.filter((p) => !p.current && p.target !== null).length),
  )
  const showCharts = closedWithGoal >= 2
  const pastSummary = items
    .map(({ metric }) => {
      const last3 = past
        .slice(0, 3)
        .map((p) => p.rows.find((r) => r.metric === metric)?.actual ?? 0)
      const max = Math.max(
        0,
        ...past.map((p) => p.rows.find((r) => r.metric === metric)?.actual ?? 0),
      )
      if (max === 0) return null
      const avg = last3.reduce((a, b) => a + b, 0) / last3.length
      return `${GOAL_LABELS[metric]}: media ${formatValue(metric, avg)} (3 meses), máximo ${formatValue(metric, max)}`
    })
    .filter((s): s is string => s !== null)

  const achievedCount = items.filter((i) => i.evaluation.status === 'achieved').length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Metas del mes</CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {achievedCount}/{items.length} conseguidas · día {today.day} de {totalDays}
          </span>
          <Link href="/settings/goals" className="underline-offset-2 hover:underline">
            Ver histórico
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 sm:grid-cols-2">
        {items.map(({ metric, row, evaluation, streak, atStake }) => {
          const copy = STATUS_COPY[evaluation.status]
          const pct = Math.min(evaluation.progressPct ?? 0, 100)
          const pace = paceText(
            metric,
            evaluation.status,
            evaluation.projected,
            evaluation.neededPerDay,
          )
          return (
            <div key={metric} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{GOAL_LABELS[metric]}</span>
                <span className={cn('text-xs font-medium', copy.className)}>{copy.label}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', copy.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>
                  {formatValue(metric, row.actual)} de {formatValue(metric, row.target as number)} ·{' '}
                  {Math.round(evaluation.progressPct ?? 0)}%
                </span>
                {streak > 0 ? (
                  <span
                    className={cn(
                      'flex items-center gap-1',
                      atStake && 'text-amber-600 dark:text-amber-400',
                    )}
                    title={
                      atStake
                        ? 'Cumple la meta este mes para mantener la racha'
                        : 'Meses consecutivos cumpliendo la meta'
                    }
                  >
                    <Flame className="size-3" aria-hidden />
                    {streak} {streak === 1 ? 'mes' : 'meses'}
                    {atStake ? ' · en juego' : ''}
                  </span>
                ) : null}
              </div>
              {pace ? <p className="text-xs text-muted-foreground">{pace}</p> : null}
            </div>
          )
        })}
        {showCharts ? (
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Últimos 6 meses</p>
            <GoalsHistoryChartLazy series={series} />
          </div>
        ) : pastSummary.length > 0 ? (
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground sm:col-span-2">
            <p className="font-medium">Referencia de meses anteriores</p>
            {pastSummary.map((line) => (
              <p key={line} className="tabular-nums">
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
