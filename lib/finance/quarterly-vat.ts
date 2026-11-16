import type { QuarterlyPeriod } from '@/lib/exports/quarterly-invoices'

export type VatRow = {
  tax_amount: number | string | null
  currency: string | null
  is_rectification?: boolean | null
}

const DAY_MS = 86_400_000

/** Estimates the quarter from recorded amounts through today, not future-dated documents. */
export function calculateQuarterlyVat(
  period: QuarterlyPeriod,
  today: string,
  invoices: readonly VatRow[],
  expenses: readonly VatRow[],
) {
  const daysBetween = (start: string, end: string) =>
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS
  const elapsedDays = daysBetween(period.start, today) + 1
  const totalDays = daysBetween(period.start, period.end)
  if (elapsedDays < 1 || elapsedDays > totalDays) throw new Error('Fecha fuera del trimestre')

  const rows = [...invoices, ...expenses]
  const isEur = (row: VatRow) => row.currency?.toUpperCase() === 'EUR'
  const hasAmount = (row: VatRow) =>
    row.tax_amount !== null && row.tax_amount !== '' && Number.isFinite(Number(row.tax_amount))
  const sumCents = (items: readonly VatRow[]) =>
    items.reduce(
      (sum, row) =>
        sum + (isEur(row) && hasAmount(row) ? Math.round(Number(row.tax_amount) * 100) : 0),
      0,
    )

  const charged = sumCents(invoices)
  const paid = sumCents(expenses)
  const balance = charged - paid
  const projectedBalance = Math.round((balance * totalDays) / elapsedDays)
  return {
    charged: charged / 100,
    paid: paid / 100,
    balance: balance / 100,
    projectedBalance: projectedBalance / 100,
    reserve: Math.max(0, projectedBalance) / 100,
    elapsedDays,
    totalDays,
    excludedCurrencyCount: rows.filter((row) => !isEur(row)).length,
    missingTaxCount: rows.filter((row) => isEur(row) && !hasAmount(row)).length,
    rectificationCount: invoices.filter((row) => row.is_rectification).length,
  }
}
