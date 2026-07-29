import { scopedLogger } from "@/lib/logger";
import { PublishError, toErrorMessage } from "@/lib/social/core";
import { googleBusinessLocationId, googleBusinessPerformanceRequest } from "./client";

const log = scopedLogger("google-business-performance");

export const GOOGLE_BUSINESS_DAILY_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_DIRECTION_REQUESTS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_BOOKINGS",
] as const;

export type GoogleBusinessDailyMetric = (typeof GOOGLE_BUSINESS_DAILY_METRICS)[number];

interface PerformanceResponse {
  timeSeries?: {
    datedValues?: Array<{
      date?: { year?: number; month?: number; day?: number };
      value?: string;
    }>;
  };
}

export interface GoogleBusinessDailyMetricValue {
  metric: GoogleBusinessDailyMetric;
  date: string;
  value: number;
}

function dateParts(value: Date) {
  return {
    year: String(value.getUTCFullYear()),
    month: String(value.getUTCMonth() + 1),
    day: String(value.getUTCDate()),
  };
}

function formatDate(date?: { year?: number; month?: number; day?: number }): string | null {
  if (!date?.year || !date.month || !date.day) return null;
  return [date.year, date.month, date.day].map((part) => String(part).padStart(2, "0")).join("-");
}

async function fetchMetric(
  metric: GoogleBusinessDailyMetric,
  start: Date,
  end: Date,
): Promise<GoogleBusinessDailyMetricValue[]> {
  const startParts = dateParts(start);
  const endParts = dateParts(end);
  const query = new URLSearchParams({
    dailyMetric: metric,
    "dailyRange.start_date.year": startParts.year,
    "dailyRange.start_date.month": startParts.month,
    "dailyRange.start_date.day": startParts.day,
    "dailyRange.end_date.year": endParts.year,
    "dailyRange.end_date.month": endParts.month,
    "dailyRange.end_date.day": endParts.day,
  });
  const data = await googleBusinessPerformanceRequest<PerformanceResponse>(
    `locations/${googleBusinessLocationId()}:getDailyMetricsTimeSeries?${query.toString()}`,
  );
  return (data.timeSeries?.datedValues ?? []).flatMap((point) => {
    const date = formatDate(point.date);
    const value = Number(point.value ?? 0);
    return date && Number.isFinite(value) ? [{ metric, date, value }] : [];
  });
}

/**
 * Fetch every daily metric, tolerating individual failures (e.g. a metric
 * deprecated for this account) so a partial sync still saves what it could.
 * But if EVERY metric request fails — the telltale sign of the Performance
 * API not being enabled/authorized yet — surface that as a thrown error
 * instead of silently returning `[]`, which upstream would otherwise persist
 * as "0 metrics synced" and look like a successful sync with zero traffic.
 */
export async function fetchGoogleBusinessPerformance(
  days = 30,
): Promise<GoogleBusinessDailyMetricValue[]> {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, Math.min(days, 90)));
  const results = await Promise.allSettled(
    GOOGLE_BUSINESS_DAILY_METRICS.map((metric) => fetchMetric(metric, start, end)),
  );

  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (rejected.length === results.length) {
    const reason = toErrorMessage(rejected[0]?.reason);
    throw new PublishError(
      "google_business_profile",
      `No se pudieron obtener las métricas de Google Business Profile: ${reason}`,
    );
  }
  if (rejected.length > 0) {
    log.warn(
      {
        failed: rejected.length,
        total: results.length,
        reason: toErrorMessage(rejected[0]?.reason),
      },
      "some_google_business_metrics_failed",
    );
  }

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
