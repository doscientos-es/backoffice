import type { BillingCycle } from '@/lib/finance'

export type SubscriptionCycle = Exclude<BillingCycle, 'none'>

const MS_PER_DAY = 24 * 60 * 60 * 1000

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

/** Converts the monthly maintenance price into the selected billing period. */
export function recurringAmount(monthlyAmount: number, cycle: SubscriptionCycle): number {
  const multiplier = cycle === 'monthly' ? 1 : cycle === 'quarterly' ? 3 : 12
  return Math.round(monthlyAmount * multiplier * 100) / 100
}

/**
 * Annual subscriptions are anchored to 1 January. The first period is the
 * fraction between the start date and the following 1 January.
 */
export function annualProration(startDate: string): {
  endDate: string
  percentage: number
} {
  const start = utcDate(startDate)
  const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1))
  const nextYear = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1))
  const days = Math.max(0, Math.round((nextYear.getTime() - start.getTime()) / MS_PER_DAY))
  const yearDays = Math.round((nextYear.getTime() - yearStart.getTime()) / MS_PER_DAY)

  return {
    endDate: isoDate(nextYear),
    percentage: Math.round((days / yearDays) * 10000) / 100,
  }
}
