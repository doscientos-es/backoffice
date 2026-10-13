import type { Metadata } from 'next'

import { GoalsHistoryChartLazy } from '@/components/goals/goals-history-chart-lazy'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requirePageRole } from '@/lib/auth'
import { formatGoalValue, GOAL_LABELS, GOAL_METRICS } from '@/lib/dashboard/goals'
import { getCompanyGoals, getGoalMonths } from '@/lib/dashboard/queries'
import { cn } from '@/lib/utils'

import { GoalsForm } from './goals-form'

export const metadata: Metadata = { title: 'Metas · Ajustes · doscientos' }
export const dynamic = 'force-dynamic'

export default async function GoalsSettingsPage() {
  await requirePageRole(['owner', 'admin'])
  const [goals, months] = await Promise.all([getCompanyGoals(), getGoalMonths(7)])
  const [, ...past] = months // completed months only, newest first
  const series = GOAL_METRICS.map((metric) => ({
    metric,
    points: [...months].reverse().map(({ month, rows }, i, all) => {
      const row = rows.find((r) => r.metric === metric)
      return {
        month,
        actual: row?.actual ?? 0,
        target: row?.target ?? null,
        current: i === all.length - 1,
      }
    }),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Metas"
        description="Objetivos mensuales de empresa que se muestran como progreso en el dashboard."
      />
      <Card>
        <CardContent className="pt-6">
          <GoalsForm goals={goals} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Evolución mensual</CardTitle>
        </CardHeader>
        <CardContent>
          <GoalsHistoryChartLazy series={series} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Histórico de metas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Mes</th>
                {GOAL_METRICS.map((m) => (
                  <th key={m} className="py-2 pr-4 font-medium">
                    {GOAL_LABELS[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {past.map(({ month, rows }) => (
                <tr key={month} className="border-t">
                  <td className="py-2 pr-4 tabular-nums">{month}</td>
                  {GOAL_METRICS.map((metric) => {
                    const row = rows.find((r) => r.metric === metric)
                    if (!row) {
                      return (
                        <td key={metric} className="py-2 pr-4 text-muted-foreground">
                          –
                        </td>
                      )
                    }
                    if (row.target === null) {
                      return (
                        <td key={metric} className="py-2 pr-4 text-muted-foreground tabular-nums">
                          {formatGoalValue(metric, row.actual)}{' '}
                          <span className="text-xs">(sin meta)</span>
                        </td>
                      )
                    }
                    const hit = row.actual >= row.target
                    return (
                      <td
                        key={metric}
                        className={cn(
                          'py-2 pr-4 tabular-nums',
                          hit ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                        )}
                      >
                        {hit ? '✓' : '✗'} {formatGoalValue(metric, row.actual)} /{' '}
                        {formatGoalValue(metric, row.target)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            El objetivo de cada mes es el que estaba vigente en ese momento. Los meses anteriores a
            esta función no tienen meta registrada.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
