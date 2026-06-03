import { scopedLogger } from "@/lib/logger";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import { cache } from "react";
import type { MarketingSort, MarketingView } from "./range";
import type {
  ActiveAdRow,
  CampaignRow,
  CampaignsOverview,
  InsightsTimePoint,
  MarketingOverview,
  MetaAdsBalance,
  MetaAdsBalanceStatus,
  RawAdRow,
  RawInsightRow,
} from "./types";

const log = scopedLogger("marketing.queries");

function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

function weightedAvg(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function aggregateInsights(insights: RawInsightRow[]) {
  const spend = sum(insights.map((i) => i.spend));
  const impressions = sum(insights.map((i) => i.impressions));
  const clicks = sum(insights.map((i) => i.clicks));
  const leads = sum(insights.map((i) => i.total_leads));
  // CTR / CPC are recomputed from totals so they remain accurate across days,
  // instead of averaging Meta's per-row ratios.
  const ctr = weightedAvg(clicks * 100, impressions);
  const cpc = weightedAvg(spend, clicks);
  const cpl = weightedAvg(spend, leads);
  const currency = insights.find((i) => i.currency)?.currency ?? "EUR";
  return { spend, impressions, clicks, leads, ctr, cpc, cpl, currency };
}

const COMPARATORS: Record<MarketingSort, (a: ActiveAdRow, b: ActiveAdRow) => number> = {
  spend_desc: (a, b) => b.spend - a.spend,
  spend_asc: (a, b) => a.spend - b.spend,
  leads_desc: (a, b) => b.leads - a.leads,
  // Ads with zero leads are pushed to the bottom under "best CPL"
  cpl_asc: (a, b) => (a.leads === 0 ? 1 : b.leads === 0 ? -1 : a.cpl - b.cpl),
  ctr_desc: (a, b) => b.ctr - a.ctr,
  name_asc: (a, b) => a.name.localeCompare(b.name, "es"),
};

export type AdsOverviewOptions = {
  since: string;
  until: string;
  includePaused?: boolean;
  sort?: MarketingSort;
};

export async function getActiveAdsOverview(opts: AdsOverviewOptions): Promise<MarketingOverview> {
  const supabase = await createServerClient();

  // marketing_* tables hold external data from Meta and do not use the soft-delete convention.
  let query = supabase.from("marketing_ads").select(
    `id, name, status, preview_url, updated_at,
       marketing_campaigns ( name ),
       marketing_insights ( spend, impressions, clicks, ctr, cpc, total_leads, cost_per_lead, currency, date_start, date_stop )`,
  );
  if (!opts.includePaused) query = query.eq("status", "ACTIVE");

  const { data: adsData, error: adsErr } = await query;
  if (adsErr) log.error({ err: adsErr }, "marketing_ads query failed");

  const ads = (adsData as unknown as RawAdRow[]) || [];
  const sortKey: MarketingSort = opts.sort ?? "spend_desc";

  const processedAds: ActiveAdRow[] = ads.map((ad) => {
    // Filter insights to the selected window. `date_start` is a `YYYY-MM-DD`
    // string from Supabase, so lexicographic compare matches calendar order.
    // `date_start === date_stop` keeps only true daily rows, ignoring any legacy
    // aggregate row (date_start = since, date_stop = until) that would otherwise
    // pile a whole period's totals onto a single day.
    const insights = (ad.marketing_insights ?? []).filter(
      (i) =>
        i.date_start &&
        i.date_start === i.date_stop &&
        i.date_start >= opts.since &&
        i.date_start <= opts.until,
    );
    const agg = aggregateInsights(insights);
    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns;

    return {
      id: ad.id,
      name: ad.name,
      status: ad.status || "UNKNOWN",
      preview_url: ad.preview_url || null,
      campaignName: campaign?.name || "Sin campaña",
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      leads: agg.leads,
      ctr: agg.ctr,
      cpc: agg.cpc,
      cpl: agg.cpl,
      currency: agg.currency,
    };
  });

  processedAds.sort(COMPARATORS[sortKey]);

  const totalSpent = sum(processedAds.map((a) => a.spend));
  const totalImpressions = sum(processedAds.map((a) => a.impressions));
  const totalClicks = sum(processedAds.map((a) => a.clicks));
  const totalLeads = sum(processedAds.map((a) => a.leads));
  const currency = processedAds.find((a) => a.currency)?.currency ?? "EUR";
  const lastSyncAt = ads.reduce<string | null>((max, a) => {
    if (!a.updated_at) return max;
    return !max || a.updated_at > max ? a.updated_at : max;
  }, null);

  return {
    ads: processedAds,
    totalSpent,
    totalLeads,
    totalImpressions,
    totalClicks,
    avgCpl: weightedAvg(totalSpent, totalLeads),
    avgCtr: weightedAvg(totalClicks * 100, totalImpressions),
    avgCpc: weightedAvg(totalSpent, totalClicks),
    currency,
    lastSyncAt,
  };
}

const CAMPAIGN_COMPARATORS: Record<MarketingSort, (a: CampaignRow, b: CampaignRow) => number> = {
  spend_desc: (a, b) => b.spend - a.spend,
  spend_asc: (a, b) => a.spend - b.spend,
  leads_desc: (a, b) => b.leads - a.leads,
  cpl_asc: (a, b) => (a.leads === 0 ? 1 : b.leads === 0 ? -1 : a.cpl - b.cpl),
  ctr_desc: (a, b) => b.ctr - a.ctr,
  name_asc: (a, b) => a.name.localeCompare(b.name, "es"),
};

export type CampaignsOverviewOptions = {
  since: string;
  until: string;
  sort?: MarketingSort;
};

/**
 * Aggregates already-synced ad-level insights into per-campaign totals. We
 * derive this from `marketing_ads → marketing_insights` instead of calling
 * Meta's campaign-level endpoint to avoid an extra API hit on every render
 * and to keep the same `since/until` window as the ads view.
 */
export async function getCampaignsOverview(
  opts: CampaignsOverviewOptions,
): Promise<CampaignsOverview> {
  const supabase = await createServerClient();

  const { data: adsData, error: adsErr } = await supabase.from("marketing_ads").select(
    `id, status, updated_at, campaign_id,
       marketing_campaigns ( id, name, status, objective ),
       marketing_insights ( spend, impressions, clicks, ctr, cpc, total_leads, cost_per_lead, currency, date_start, date_stop )`,
  );
  if (adsErr) log.error({ err: adsErr }, "marketing_ads (campaign view) query failed");

  const ads = (adsData as unknown as RawAdRow[]) || [];

  const byCampaign = new Map<string, { row: CampaignRow; insights: RawInsightRow[] }>();

  for (const ad of ads) {
    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns;
    const campaignId = campaign?.id ?? ad.campaign_id ?? "__none__";
    const insights = (ad.marketing_insights ?? []).filter(
      (i) =>
        i.date_start &&
        i.date_start === i.date_stop &&
        i.date_start >= opts.since &&
        i.date_start <= opts.until,
    );

    let bucket = byCampaign.get(campaignId);
    if (!bucket) {
      bucket = {
        row: {
          id: campaignId,
          name: campaign?.name || "Sin campaña",
          status: campaign?.status || "UNKNOWN",
          objective: campaign?.objective ?? null,
          adCount: 0,
          activeAdCount: 0,
          spend: 0,
          impressions: 0,
          clicks: 0,
          leads: 0,
          ctr: 0,
          cpc: 0,
          cpl: 0,
          currency: "EUR",
        },
        insights: [],
      };
      byCampaign.set(campaignId, bucket);
    }
    bucket.row.adCount += 1;
    if (ad.status === "ACTIVE") bucket.row.activeAdCount += 1;
    bucket.insights.push(...insights);
  }

  const campaigns: CampaignRow[] = Array.from(byCampaign.values()).map(({ row, insights }) => {
    const agg = aggregateInsights(insights);
    return {
      ...row,
      spend: agg.spend,
      impressions: agg.impressions,
      clicks: agg.clicks,
      leads: agg.leads,
      ctr: agg.ctr,
      cpc: agg.cpc,
      cpl: agg.cpl,
      currency: agg.currency,
    };
  });

  const sortKey: MarketingSort = opts.sort ?? "spend_desc";
  campaigns.sort(CAMPAIGN_COMPARATORS[sortKey]);

  const totalSpent = sum(campaigns.map((c) => c.spend));
  const totalImpressions = sum(campaigns.map((c) => c.impressions));
  const totalClicks = sum(campaigns.map((c) => c.clicks));
  const totalLeads = sum(campaigns.map((c) => c.leads));
  const currency = campaigns.find((c) => c.spend > 0)?.currency ?? "EUR";
  const lastSyncAt = ads.reduce<string | null>((max, a) => {
    if (!a.updated_at) return max;
    return !max || a.updated_at > max ? a.updated_at : max;
  }, null);

  return {
    campaigns,
    totalSpent,
    totalLeads,
    totalImpressions,
    totalClicks,
    avgCpl: weightedAvg(totalSpent, totalLeads),
    avgCtr: weightedAvg(totalClicks * 100, totalImpressions),
    avgCpc: weightedAvg(totalSpent, totalClicks),
    currency,
    lastSyncAt,
  };
}

export type TimeSeriesOptions = {
  since: string;
  until: string;
};

/**
 * Account-wide daily series for the evolution chart. Reads `marketing_insights`
 * directly (rather than going through ads) and folds every ad's row for a given
 * day into a single point, so the chart reflects total spend/leads/clics/
 * impresiones per day regardless of ad status.
 */
export async function getInsightsTimeSeries(opts: TimeSeriesOptions): Promise<InsightsTimePoint[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("marketing_insights")
    .select("date_start, date_stop, spend, total_leads, clicks, impressions")
    .gte("date_start", opts.since)
    .lte("date_start", opts.until);
  if (error) log.error({ err: error }, "marketing_insights time-series query failed");

  const rows = (data as unknown as RawInsightRow[]) || [];
  const byDay = new Map<string, InsightsTimePoint>();

  for (const row of rows) {
    // Skip aggregate rows (date_start !== date_stop): they hold a whole
    // period's totals and would spike a single day on the chart.
    if (!row.date_start || row.date_start !== row.date_stop) continue;
    let point = byDay.get(row.date_start);
    if (!point) {
      point = { date: row.date_start, spend: 0, leads: 0, clicks: 0, impressions: 0 };
      byDay.set(row.date_start, point);
    }
    point.spend += row.spend ?? 0;
    point.leads += row.total_leads ?? 0;
    point.clicks += row.clicks ?? 0;
    point.impressions += row.impressions ?? 0;
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export type MarketingOverviewResult =
  | ({ view: "ads" } & MarketingOverview)
  | ({ view: "campaigns" } & CampaignsOverview);

/**
 * Unified overview resolver shared by the KPI and table sections. Wrapped in
 * React `cache()` with primitive arguments so both sections (rendered in
 * parallel under their own Suspense boundaries) trigger a single DB round-trip
 * per request instead of fetching the same data twice.
 */
export const getMarketingOverview = cache(
  async (
    view: MarketingView,
    since: string,
    until: string,
    sort: MarketingSort,
    showPaused: boolean,
  ): Promise<MarketingOverviewResult> => {
    if (view === "campaigns") {
      const overview = await getCampaignsOverview({ since, until, sort });
      return { view: "campaigns", ...overview };
    }
    const overview = await getActiveAdsOverview({ since, until, includePaused: showPaused, sort });
    return { view: "ads", ...overview };
  },
);

// --- Meta Ads balance -------------------------------------------------------

/** Low-balance alert thresholds for the Meta Ads account. */
const META_BALANCE_WARNING_EUR = 50;
const META_BALANCE_WARNING_DAYS = 7;
const META_BALANCE_CRITICAL_DAYS = 3;
/** Trailing window used to estimate the daily burn rate. */
const META_BURN_WINDOW_DAYS = 30;

/**
 * Estimated Meta Ads account balance: total recorded recharges (expenses with
 * category `meta_ads`) minus the spend Meta has reported. Also derives a daily
 * burn rate from the trailing window to estimate the remaining runway and an
 * alert status so the dashboard can warn before the account runs dry.
 *
 * Returns `null` when there is neither a recharge nor any spend yet, so callers
 * can skip rendering the widget entirely.
 */
export async function getMetaAdsBalance(): Promise<MetaAdsBalance | null> {
  const supabase = await createServerClient();

  const burnFloor = new Date(Date.now() - META_BURN_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const [
    { data: rechargeRows, error: rechargeErr },
    { data: spendRows, error: spendErr },
    { data: burnRows, error: burnErr },
  ] = await Promise.all([
    notDeleted(supabase.from("expenses").select("total").eq("category", "meta_ads")).neq(
      "status",
      "cancelled",
    ),
    supabase.from("marketing_insights").select("spend, currency"),
    supabase.from("marketing_insights").select("spend").gte("date_start", burnFloor),
  ]);

  if (rechargeErr) log.error({ err: rechargeErr.message }, "meta_balance_recharges_failed");
  if (spendErr) log.error({ err: spendErr.message }, "meta_balance_spend_failed");
  if (burnErr) log.error({ err: burnErr.message }, "meta_balance_burn_failed");

  const totalRecharged = sum((rechargeRows ?? []).map((r) => Number(r.total ?? 0)));
  const totalSpent = sum((spendRows ?? []).map((r) => Number(r.spend ?? 0)));

  // Nothing recorded yet — let the caller skip the widget.
  if (totalRecharged === 0 && totalSpent === 0) return null;

  const balance = totalRecharged - totalSpent;
  const burnTotal = sum((burnRows ?? []).map((r) => Number(r.spend ?? 0)));
  const dailyBurn = burnTotal / META_BURN_WINDOW_DAYS;
  const daysRemaining = dailyBurn > 0 ? balance / dailyBurn : null;

  let status: MetaAdsBalanceStatus = "ok";
  if (balance <= 0 || (daysRemaining !== null && daysRemaining < META_BALANCE_CRITICAL_DAYS)) {
    status = "critical";
  } else if (
    balance < META_BALANCE_WARNING_EUR ||
    (daysRemaining !== null && daysRemaining < META_BALANCE_WARNING_DAYS)
  ) {
    status = "warning";
  }

  const currency = (spendRows ?? []).find((r) => r.currency)?.currency ?? "EUR";

  return { totalRecharged, totalSpent, balance, dailyBurn, daysRemaining, status, currency };
}
