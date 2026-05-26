/**
 * Pure helpers for the finance module: aggregation and totals.
 *
 * Kept side-effect free so they can be unit tested without a DB.
 */

export const EXPENSE_CATEGORIES = [
  "hosting",
  "domain",
  "service",
  "software",
  "hardware",
  "office",
  "marketing",
  "professional",
  "travel",
  "taxes",
  "salary",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ["pending", "paid", "cancelled"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const EXPENSE_RECURRENCES = ["none", "monthly", "quarterly", "yearly"] as const;
export type ExpenseRecurrence = (typeof EXPENSE_RECURRENCES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  hosting: "Hosting",
  domain: "Dominios",
  service: "Servicios API",
  software: "Software / SaaS",
  hardware: "Hardware",
  office: "Oficina",
  marketing: "Marketing",
  professional: "Profesionales",
  travel: "Desplazamientos",
  taxes: "Impuestos",
  salary: "Salarios",
  other: "Otros",
};

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  cancelled: "Cancelado",
};

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  none: "Único",
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

/** Compute tax_amount and total from subtotal and tax_rate (%). */
export function computeExpenseTotals(
  subtotal: number,
  taxRate: number,
): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const safeSubtotal = Number.isFinite(subtotal) ? subtotal : 0;
  const safeRate = Number.isFinite(taxRate) ? taxRate : 0;
  const taxAmount = Math.round(safeSubtotal * safeRate) / 100;
  const total = Math.round((safeSubtotal + taxAmount) * 100) / 100;
  return {
    subtotal: Math.round(safeSubtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total,
  };
}

export type MonthlyPoint = {
  /** Short ES month label ("ene", "feb"...). */
  month: string;
  revenue: number;
  expense: number;
  /** revenue - expense */
  net: number;
};

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

/**
 * Build a 6-month rolling series (oldest -> current month) combining revenue
 * (invoice totals by issue_date) and expenses (by expense_date).
 *
 * The reference date is `now`, defaulting to today; useful for tests.
 */
export function buildMonthlySeries(
  revenueRows: ReadonlyArray<{ date: string | Date; total: number }>,
  expenseRows: ReadonlyArray<{ date: string | Date; total: number }>,
  now: Date = new Date(),
): MonthlyPoint[] {
  const months = new Map<string, MonthlyPoint>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months.set(key, {
      month: MONTHS_ES[d.getMonth()] ?? "",
      revenue: 0,
      expense: 0,
      net: 0,
    });
  }

  const addTo = (
    source: ReadonlyArray<{ date: string | Date; total: number }>,
    key: "revenue" | "expense",
  ) => {
    for (const row of source) {
      const d = typeof row.date === "string" ? new Date(row.date) : row.date;
      const mapKey = `${d.getFullYear()}-${d.getMonth()}`;
      const point = months.get(mapKey);
      if (!point) continue;
      point[key] += Number(row.total ?? 0);
    }
  };

  addTo(revenueRows, "revenue");
  addTo(expenseRows, "expense");

  return Array.from(months.values()).map((p) => ({
    month: p.month,
    revenue: Math.round(p.revenue * 100) / 100,
    expense: Math.round(p.expense * 100) / 100,
    net: Math.round((p.revenue - p.expense) * 100) / 100,
  }));
}

/** Profit margin as a 0..100 percentage, or null when revenue is 0. */
export function profitMargin(revenue: number, expense: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  const margin = ((revenue - expense) / revenue) * 100;
  return Math.round(margin * 10) / 10;
}
