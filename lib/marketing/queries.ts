import { scopedLogger } from "@/lib/logger";
import { notDeleted } from "@/lib/supabase/filters";
import { createServerClient } from "@/lib/supabase/server";
import { cache } from "react";
import type { MarketingSort, MarketingView } from "./range";
import type {
  ActiveAdRow,
  CampaignRow,
  CampaignsOverview,
  InsightsBreakdown,
  InsightsBreakdownPoint,
  InsightsSeriesMeta,
  MarketingOverview,
  MetaAdsBalance,
  MetaAdsBalanceStatus,
  RawAdRow,
  RawInsightRow,
} from "./types";
import { INSIGHTS_OTHERS_KEY } from "./types";

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

export type BreakdownOptions = {
  since: string;
  until: string;
  dimension: MarketingView;
};

/** Number of top spenders shown as their own stacked series before "Otros". */
const INSIGHTS_TOP_SERIES = 6;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Daily spend for the evolution chart, broken down by the active dimension (ad
 * or campaign). Walks `marketing_ads → marketing_insights` so each daily row
 * keeps its ad/campaign identity, then keeps the top spenders as their own
 * stacked series and folds the rest into a single "Otros" bucket so the chart
 * stays readable. `leads` and `total` are account-wide per day, independent of
 * how spend is split, so the leads line and the stack height stay accurate.
 */
export async function getInsightsBreakdownSeries(
  opts: BreakdownOptions,
): Promise<InsightsBreakdown> {
  const supabase = await createServerClient();

  const { data: adsData, error } = await supabase.from("marketing_ads").select(
    `id, name, campaign_id,
       marketing_campaigns ( id, name ),
       marketing_insights ( spend, total_leads, date_start, date_stop )`,
  );
  if (error) log.error({ err: error }, "marketing_insights breakdown query failed");

  const ads = (adsData as unknown as RawAdRow[]) || [];

  const entityLabel = new Map<string, string>();
  const entityTotal = new Map<string, number>();
  const spendByDayEntity = new Map<string, Map<string, number>>();
  const leadsByDay = new Map<string, number>();

  for (const ad of ads) {
    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns;
    const key =
      opts.dimension === "campaigns" ? (campaign?.id ?? ad.campaign_id ?? "__none__") : ad.id;
    const label =
      opts.dimension === "campaigns" ? campaign?.name || "Sin campaña" : ad.name || "Sin nombre";
    entityLabel.set(key, label);

    for (const i of ad.marketing_insights ?? []) {
      // Daily rows only (date_start === date_stop); ignore period aggregates.
      if (!i.date_start || i.date_start !== i.date_stop) continue;
      if (i.date_start < opts.since || i.date_start > opts.until) continue;

      const spend = i.spend ?? 0;
      entityTotal.set(key, (entityTotal.get(key) ?? 0) + spend);
      leadsByDay.set(i.date_start, (leadsByDay.get(i.date_start) ?? 0) + (i.total_leads ?? 0));

      let dayMap = spendByDayEntity.get(i.date_start);
      if (!dayMap) {
        dayMap = new Map();
        spendByDayEntity.set(i.date_start, dayMap);
      }
      dayMap.set(key, (dayMap.get(key) ?? 0) + spend);
    }
  }

  // Rank by total spend and keep the top N as their own series; everything
  // else collapses into "Otros".
  const topKeys = Array.from(entityTotal.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, INSIGHTS_TOP_SERIES)
    .map(([key]) => key);
  const topSet = new Set(topKeys);
  const hasOthers = Array.from(entityLabel.keys()).some((k) => !topSet.has(k));

  const series: InsightsSeriesMeta[] = topKeys.map((key) => ({
    key,
    label: entityLabel.get(key) ?? key,
  }));
  if (hasOthers) series.push({ key: INSIGHTS_OTHERS_KEY, label: "Otros" });

  const points: InsightsBreakdownPoint[] = Array.from(spendByDayEntity.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMap]) => {
      const point: InsightsBreakdownPoint = {
        date,
        total: 0,
        leads: leadsByDay.get(date) ?? 0,
      };
      // Seed every series so Recharts always resolves each dynamic dataKey.
      for (const key of topKeys) point[key] = 0;
      if (hasOthers) point[INSIGHTS_OTHERS_KEY] = 0;

      let total = 0;
      for (const [key, spend] of dayMap) {
        total += spend;
        const bucket = topSet.has(key) ? key : INSIGHTS_OTHERS_KEY;
        point[bucket] = round2((point[bucket] as number) + spend);
      }
      point.total = round2(total);
      return point;
    });

  return { dimension: opts.dimension, points, series };
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
