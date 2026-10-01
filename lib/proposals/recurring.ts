import type { BillingCycle, LineItem } from '@/lib/finance'
import { roundCurrency } from '@/lib/finance'

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

const ANNUAL_PRORATION_PREFIX = 'Parte proporcional automática · '

export type ProposalBillingLine = {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  billing_cycle?: BillingCycle | null
  id?: string
}

export type NormalizedProposalBillingLine = Omit<ProposalBillingLine, 'id' | 'billing_cycle'> & {
  id: string
  billing_cycle: BillingCycle
}

function asDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string') {
    const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00Z`)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

/** Months remaining in the calendar year, including the current month. */
export function calendarYearMonthsRemaining(value?: string | Date | null): number {
  return 12 - asDate(value).getUTCMonth()
}

export function annualProratedAmount(
  line: Pick<ProposalBillingLine, 'quantity' | 'unit_price'>,
  value?: string | Date | null,
): number {
  return roundCurrency(
    (Number(line.quantity) || 0) *
      (Number(line.unit_price) || 0) *
      (calendarYearMonthsRemaining(value) / 12),
  )
}

export function isAutomaticAnnualProration(
  line: Pick<ProposalBillingLine, 'description'>,
): boolean {
  const description = line.description.trim().toLowerCase()
  return (
    description.startsWith(ANNUAL_PRORATION_PREFIX.toLowerCase()) ||
    description.startsWith('parte proporcional') ||
    description.startsWith('prorrata')
  )
}

/** Adds or refreshes the initial charge for annual lines. */
export function ensureCalendarYearProration(
  items: readonly ProposalBillingLine[],
  startDate?: string | Date | null,
): NormalizedProposalBillingLine[] {
  const annualLines = items.filter(
    (line) => line.billing_cycle === 'yearly' && !isAutomaticAnnualProration(line),
  )
  const existingProrations = items.filter(isAutomaticAnnualProration)
  const untouched = items.filter((line) => !isAutomaticAnnualProration(line))
  const prorations = annualLines.map((source, index) => {
    const existing = existingProrations[index]
    const sourceId = source.id ?? `annual-${index}`
    return {
      id: existing?.id ?? `annual-proration-${sourceId}`,
      description: `${ANNUAL_PRORATION_PREFIX}${source.description}`,
      quantity: 1,
      unit_price: annualProratedAmount(source, startDate),
      vat_rate: source.vat_rate,
      billing_cycle: 'none' as const,
    }
  })

  const normalizedUntouched = untouched.map((line, index) => ({
    ...line,
    id: line.id ?? `proposal-line-${index}`,
    billing_cycle: line.billing_cycle ?? 'none',
  }))

  return [...normalizedUntouched, ...prorations]
}

function recurringCycles(items: readonly ProposalBillingLine[]): BillingCycle[] {
  return [
    ...new Set(
      items
        .filter((line) => !isAutomaticAnnualProration(line))
        .map((line) => line.billing_cycle ?? 'none')
        .filter((cycle): cycle is BillingCycle => cycle !== 'none'),
    ),
  ]
}

/** Default client-facing payment language for recurring proposal lines. */
export function recurringPaymentTerms(
  items: readonly ProposalBillingLine[],
  startDate?: string | Date | null,
): string | null {
  const cycles = recurringCycles(items)
  if (cycles.length === 0) return null

  const lines = [
    'Las cuotas recurrentes se facturarán por adelantado según la cadencia indicada en cada línea.',
  ]
  if (cycles.includes('yearly')) {
    const months = calendarYearMonthsRemaining(startDate)
    lines.push(
      `La primera cuota anual se calcula automáticamente de forma proporcional a los ${months} meses restantes del año natural (${months}/12 de la cuota anual). Las siguientes cuotas anuales vencerán el 1 de enero de cada año.`,
      'La cuota anual se actualizará en cada renovación conforme a la variación interanual positiva del IPC general publicada por el INE para el periodo de referencia anterior. El importe actualizado se comunicará antes de cada renovación.',
    )
  }
  return lines.join('\n\n')
}
