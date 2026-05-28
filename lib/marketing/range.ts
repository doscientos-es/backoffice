/**
 * Marketing dashboard date-range and sort parsing.
 * All UI controls are URL-driven so the server component can render the right
 * window without any client-side state.
 */

export type MarketingRange = "7d" | "30d" | "90d" | "month";

const VALID_RANGES: ReadonlySet<MarketingRange> = new Set(["7d", "30d", "90d", "month"]);

export const RANGE_OPTIONS: { value: MarketingRange; label: string; short: string }[] = [
  { value: "7d", label: "Últimos 7 días", short: "7d" },
  { value: "30d", label: "Últimos 30 días", short: "30d" },
  { value: "90d", label: "Últimos 90 días", short: "90d" },
  { value: "month", label: "Este mes", short: "Mes" },
];

export function parseMarketingRange(value: string | string[] | undefined): MarketingRange {
  const v = Array.isArray(value) ? value[0] : value;
  return v && VALID_RANGES.has(v as MarketingRange) ? (v as MarketingRange) : "30d";
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0] ?? "";
}

export function rangeToDates(range: MarketingRange): {
  since: string;
  until: string;
  label: string;
} {
  const now = new Date();
  const until = toIsoDate(now);
  switch (range) {
    case "7d":
      return {
        since: toIsoDate(new Date(now.getTime() - 7 * 86_400_000)),
        until,
        label: "Últimos 7 días",
      };
    case "90d":
      return {
        since: toIsoDate(new Date(now.getTime() - 90 * 86_400_000)),
        until,
        label: "Últimos 90 días",
      };
    case "month":
      return {
        since: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        until,
        label: "Este mes",
      };
    default:
      return {
        since: toIsoDate(new Date(now.getTime() - 30 * 86_400_000)),
        until,
        label: "Últimos 30 días",
      };
  }
}

export type MarketingSort =
  | "spend_desc"
  | "spend_asc"
  | "leads_desc"
  | "cpl_asc"
  | "ctr_desc"
  | "name_asc";

const VALID_SORTS: ReadonlySet<MarketingSort> = new Set([
  "spend_desc",
  "spend_asc",
  "leads_desc",
  "cpl_asc",
  "ctr_desc",
  "name_asc",
]);

export const SORT_OPTIONS: { value: MarketingSort; label: string }[] = [
  { value: "spend_desc", label: "Gasto (mayor)" },
  { value: "spend_asc", label: "Gasto (menor)" },
  { value: "leads_desc", label: "Leads (mayor)" },
  { value: "cpl_asc", label: "CPL (mejor)" },
  { value: "ctr_desc", label: "CTR (mejor)" },
  { value: "name_asc", label: "Nombre (A→Z)" },
];

export function parseMarketingSort(value: string | string[] | undefined): MarketingSort {
  const v = Array.isArray(value) ? value[0] : value;
  return v && VALID_SORTS.has(v as MarketingSort) ? (v as MarketingSort) : "spend_desc";
}

export function parseShowPaused(value: string | string[] | undefined): boolean {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "1" || v === "true";
}

export type MarketingView = "ads" | "campaigns";

const VALID_VIEWS: ReadonlySet<MarketingView> = new Set(["ads", "campaigns"]);

export function parseMarketingView(value: string | string[] | undefined): MarketingView {
  const v = Array.isArray(value) ? value[0] : value;
  return v && VALID_VIEWS.has(v as MarketingView) ? (v as MarketingView) : "ads";
}
