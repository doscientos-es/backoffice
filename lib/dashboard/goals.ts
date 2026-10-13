import { formatEUR } from '@/lib/utils'

import type { GoalMetric } from './types'

export const GOAL_METRICS: GoalMetric[] = [
  'leads_new',
  'proposals_sent',
  'revenue',
  'conversion_rate',
]

export const GOAL_LABELS: Record<GoalMetric, string> = {
  leads_new: 'Leads nuevos',
  proposals_sent: 'Propuestas enviadas',
  revenue: 'Facturación',
  conversion_rate: 'Conversión',
}

export function formatGoalValue(metric: GoalMetric, value: number): string {
  if (metric === 'revenue') return formatEUR(value)
  if (metric === 'conversion_rate') return `${Math.round(value * 1000) / 10}%`
  return String(Math.round(value))
}

export type GoalStatus =
  | 'no_goal'
  | 'achieved'
  | 'missed'
  | 'early'
  | 'on_track'
  | 'at_risk'
  | 'behind'

export type GoalMonthRow = { metric: GoalMetric; target: number | null; actual: number }

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

export function monthKey(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 7)
}

export function shiftMonth(key: string, delta: number): string {
  const [y = 0, m = 1] = key.split('-').map(Number)
  return monthKey(y, m + delta)
}

export function daysInMonth(key: string): number {
  const [y = 0, m = 1] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function madridToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: pick('year'), month: pick('month'), day: pick('day') }
}

/** Evaluates one goal. `day` is null for months that already ended. Projection starts on day 5. */
export function evaluateGoal(
  metric: GoalMetric,
  target: number | null,
  actual: number,
  day: number | null,
  totalDays: number,
) {
  if (target === null) {
    return {
      status: 'no_goal' as GoalStatus,
      progressPct: null,
      projected: null,
      remaining: null,
      neededPerDay: null,
    }
  }
  const progressPct = round((actual / target) * 100, 1)
  const remaining = round(Math.max(target - actual, 0), metric === 'conversion_rate' ? 3 : 2)
  const base = { progressPct, remaining }
  if (actual >= target)
    return { ...base, status: 'achieved' as GoalStatus, projected: null, neededPerDay: null }
  if (day === null)
    return { ...base, status: 'missed' as GoalStatus, projected: null, neededPerDay: null }
  const cumulative = metric !== 'conversion_rate'
  const daysLeft = Math.max(totalDays - day, 0)
  const neededPerDay = cumulative && daysLeft > 0 ? round(remaining / daysLeft, 2) : null
  if (day < 5) return { ...base, status: 'early' as GoalStatus, projected: null, neededPerDay }
  const projected = cumulative ? round((actual / day) * totalDays, 2) : actual
  const ratio = projected / target
  const status: GoalStatus = ratio >= 1 ? 'on_track' : ratio >= 0.8 ? 'at_risk' : 'behind'
  return { ...base, status, projected, neededPerDay }
}

/** Consecutive achieved months, newest first. A month without target or below target breaks it. */
export function achievedStreak(
  newestFirst: Array<{ target: number | null; actual: number } | undefined>,
): number {
  let streak = 0
  for (const row of newestFirst) {
    if (!row || row.target === null || row.actual < row.target) break
    streak += 1
  }
  return streak
}
