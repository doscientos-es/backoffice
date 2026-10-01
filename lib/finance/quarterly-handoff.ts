/**
 * Quarterly hand-off to the tax advisor (gestoría).
 * The register of a quarter is sent the first day after it closes (1 Jan/Apr/Jul/Oct).
 * A reminder shows during the 7 days before that day; once the day arrives the
 * quarter stays pending until it is sent or the AEAT filing deadline passes.
 */
import { type QuarterlyPeriod, quarterlyPeriod } from "@/lib/exports/quarterly-invoices";

export const QUARTERLY_ADVISOR_EMAIL = "fiscal@doscientos.es";
export const QUARTERLY_REMINDER_DAYS = 7;

export type QuarterlyHandoffStatus = "idle" | "upcoming" | "due" | "overdue" | "sent";

export type QuarterlyHandoff = {
  status: QuarterlyHandoffStatus;
  /** Quarter the notice refers to (the open one when `upcoming`, the last closed one otherwise). */
  period: QuarterlyPeriod;
  /** Day the register should be sent to the advisor (`period.end`). */
  handoffDate: string;
  /** AEAT deadline for the quarterly returns (20th of next month, 30 Jan for T4). */
  filingDeadline: string;
  /** Calendar days from today to `handoffDate` (negative once it has passed). */
  daysUntilHandoff: number;
};

const DAY_MS = 86_400_000;

/** Today's date (YYYY-MM-DD) in Spain, independent of the server timezone. */
export function madridToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

function quarterOf(date: string): QuarterlyPeriod {
  const month = Number(date.slice(5, 7));
  const period = quarterlyPeriod(date.slice(0, 4), String(Math.ceil(month / 3)));
  if (!period) throw new Error(`Fecha inválida: ${date}`);
  return period;
}

function previousQuarter(period: QuarterlyPeriod): QuarterlyPeriod {
  const year = period.quarter === 1 ? period.year - 1 : period.year;
  const quarter = period.quarter === 1 ? 4 : period.quarter - 1;
  return quarterlyPeriod(String(year), String(quarter)) as QuarterlyPeriod;
}

/** The last `count` closed quarters, newest first. */
export function recentClosedQuarters(today: string, count = 4): QuarterlyPeriod[] {
  const periods: QuarterlyPeriod[] = [];
  let period = previousQuarter(quarterOf(today));
  for (let i = 0; i < count; i += 1) {
    periods.push(period);
    period = previousQuarter(period);
  }
  return periods;
}

export function filingDeadline(period: QuarterlyPeriod): string {
  return period.quarter === 4 ? `${period.year + 1}-01-30` : `${period.end.slice(0, 8)}20`;
}

function describe(status: QuarterlyHandoffStatus, period: QuarterlyPeriod, today: string) {
  return {
    status,
    period,
    handoffDate: period.end,
    filingDeadline: filingDeadline(period),
    daysUntilHandoff: dayDiff(today, period.end),
  };
}

/**
 * Resolves which quarterly notice applies today.
 * `isSent` tells whether a quarter (by label, e.g. "T3 2026") was already sent to the advisor.
 */
export function quarterlyHandoff(
  today: string,
  isSent: (period: QuarterlyPeriod) => boolean,
): QuarterlyHandoff {
  const current = quarterOf(today);
  const closed = previousQuarter(current);
  const closedSent = isSent(closed);
  const withinFiling = today <= filingDeadline(closed);

  if (!closedSent && withinFiling) return describe("due", closed, today);
  if (dayDiff(today, current.end) <= QUARTERLY_REMINDER_DAYS) {
    return describe(isSent(current) ? "sent" : "upcoming", current, today);
  }
  if (closedSent) return describe(withinFiling ? "sent" : "idle", closed, today);
  return describe("overdue", closed, today);
}
