import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";

const log = scopedLogger("meta-marketing");

// ---------------- Types ----------------

export interface MetaMarketingCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  buying_type: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaMarketingAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  billing_event: string;
  optimization_goal: string;
  daily_budget?: string;
  lifetime_budget?: string;
}

export interface MetaMarketingAd {
  id: string;
  adset_id: string;
  campaign_id: string;
  name: string;
  status: string;
  creative?: {
    id: string;
    thumbnail_url?: string;
  };
}

export interface MetaActionStat {
  action_type: string;
  value: string;
}

export interface MetaMarketingInsight {
  ad_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc?: string;
  cpp?: string;
  account_currency?: string;
  actions?: MetaActionStat[];
  cost_per_action_type?: MetaActionStat[];
}

/**
 * Meta lead action types. `lead` is the legacy single-event count;
 * `onsite_conversion.lead_grouped` is the modern grouped form-fill metric.
 * Campaigns usually report one or the other depending on objective.
 */
const LEAD_ACTION_TYPES = new Set(["lead", "onsite_conversion.lead_grouped"]);

/**
 * Extracts lead count and computed cost-per-lead from a Meta insight row.
 * Cost is derived from `spend / totalLeads` rather than `cost_per_action_type`
 * to avoid double-counting when both action types coexist on the same row.
 */
export function extractMetaLeads(
  actions: MetaActionStat[] | undefined,
  spend: number,
): { totalLeads: number; costPerLead: number } {
  const totalLeads = (actions ?? [])
    .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
    .reduce((sum, a) => sum + (Number.parseFloat(a.value) || 0), 0);

  return {
    totalLeads,
    costPerLead: totalLeads > 0 ? spend / totalLeads : 0,
  };
}

// ---------------- API Calls ----------------

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 4;
const PAGE_LIMIT = 100;
const TRANSIENT_NET_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENETUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return true;
  // undici exposes the underlying cause with a Node `code`
  const cause = (err as { cause?: unknown }).cause;
  const code =
    (cause && typeof cause === "object" && "code" in cause
      ? (cause as { code?: unknown }).code
      : undefined) ?? (err as { code?: unknown }).code;
  return typeof code === "string" && TRANSIENT_NET_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if ((res.status >= 500 || res.status === 429) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250);
      log.warn({ status: res.status, attempt, delay }, "Meta API transient HTTP, retrying");
      await sleep(delay);
      return fetchWithRetry(url, attempt + 1);
    }
    return res;
  } catch (err) {
    if (isTransientNetworkError(err) && attempt < MAX_ATTEMPTS) {
      const delay = 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250);
      log.warn({ err, attempt, delay }, "Meta API transient network error, retrying");
      await sleep(delay);
      return fetchWithRetry(url, attempt + 1);
    }
    throw err;
  }
}

async function fetchMetaMarketing<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const env = serverEnv();
  const token = env.META_USER_ACCESS_TOKEN || env.META_PAGE_ACCESS_TOKEN;

  if (!token) {
    throw new Error("Meta Access Token (User or Page) not configured");
  }

  const firstUrl = new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${path}`);
  firstUrl.searchParams.set("access_token", token);
  firstUrl.searchParams.set("limit", String(PAGE_LIMIT));
  for (const [key, value] of Object.entries(params)) {
    firstUrl.searchParams.set(key, value);
  }

  const results: T[] = [];
  let nextUrl: string | null = firstUrl.toString();
  let pages = 0;

  while (nextUrl) {
    const res = await fetchWithRetry(nextUrl);
    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(`Meta API Error ${res.status}: ${errorBody.slice(0, 500)}`);
    }
    const data = (await res.json()) as { data?: T[]; paging?: { next?: string } };
    if (data.data?.length) results.push(...data.data);
    nextUrl = data.paging?.next ?? null;
    pages++;
  }

  log.debug({ path, pages, count: results.length }, "Meta API fetch complete");
  return results;
}

export async function getMetaCampaigns(): Promise<MetaMarketingCampaign[]> {
  const env = serverEnv();
  if (!env.META_AD_ACCOUNT_ID) throw new Error("META_AD_ACCOUNT_ID not configured");

  return fetchMetaMarketing<MetaMarketingCampaign>(`${env.META_AD_ACCOUNT_ID}/campaigns`, {
    fields: "id,name,status,objective,buying_type,start_time,stop_time",
  });
}

export async function getMetaAdSets(): Promise<MetaMarketingAdSet[]> {
  const env = serverEnv();
  if (!env.META_AD_ACCOUNT_ID) throw new Error("META_AD_ACCOUNT_ID not configured");

  return fetchMetaMarketing<MetaMarketingAdSet>(`${env.META_AD_ACCOUNT_ID}/adsets`, {
    fields:
      "id,campaign_id,name,status,billing_event,optimization_goal,daily_budget,lifetime_budget",
  });
}

export async function getMetaAds(): Promise<MetaMarketingAd[]> {
  const env = serverEnv();
  if (!env.META_AD_ACCOUNT_ID) throw new Error("META_AD_ACCOUNT_ID not configured");

  return fetchMetaMarketing<MetaMarketingAd>(`${env.META_AD_ACCOUNT_ID}/ads`, {
    fields: "id,adset_id,campaign_id,name,status,creative{id,thumbnail_url}",
  });
}

/**
 * Ad-level insights for a date range. Includes Meta-attributed lead actions
 * so we can compute CPL without depending on UTM matching.
 */
export async function getMetaInsights(
  since: string,
  until: string,
): Promise<MetaMarketingInsight[]> {
  const env = serverEnv();
  if (!env.META_AD_ACCOUNT_ID) throw new Error("META_AD_ACCOUNT_ID not configured");

  return fetchMetaMarketing<MetaMarketingInsight>(`${env.META_AD_ACCOUNT_ID}/insights`, {
    level: "ad",
    fields:
      "ad_id,date_start,date_stop,impressions,reach,clicks,spend,ctr,cpc,cpp,account_currency,actions,cost_per_action_type",
    time_range: JSON.stringify({ since, until }),
  });
}

/**
 * Returns the Meta-hosted preview iframe HTML for a single ad in a given
 * placement format. Body looks like `<iframe src="https://..."></iframe>`.
 */
export type MetaAdPreviewFormat =
  | "DESKTOP_FEED_STANDARD"
  | "MOBILE_FEED_STANDARD"
  | "INSTAGRAM_STANDARD"
  | "FACEBOOK_STORY_MOBILE"
  | "INSTAGRAM_STORY";

export async function getMetaAdPreview(
  adId: string,
  format: MetaAdPreviewFormat = "DESKTOP_FEED_STANDARD",
): Promise<string | null> {
  const env = serverEnv();
  const token = env.META_USER_ACCESS_TOKEN || env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("Meta Access Token (User or Page) not configured");

  const url = new URL(
    `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${adId}/previews`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("ad_format", format);

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Meta API Error ${res.status}: ${errorBody.slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: Array<{ body: string }> };
  return data.data?.[0]?.body ?? null;
}

/**
 * Campaign-level insights for active campaigns, using a Meta `date_preset`
 * (e.g. `this_month`, `last_30d`, `lifetime`). Used by the dashboard to show
 * aggregated KPIs per campaign with Meta-attributed leads.
 */
export async function getMetaCampaignInsights(
  datePreset: "today" | "yesterday" | "this_month" | "last_month" | "last_30d" | "lifetime" =
    "this_month",
): Promise<MetaMarketingInsight[]> {
  const env = serverEnv();
  if (!env.META_AD_ACCOUNT_ID) throw new Error("META_AD_ACCOUNT_ID not configured");

  return fetchMetaMarketing<MetaMarketingInsight>(`${env.META_AD_ACCOUNT_ID}/insights`, {
    level: "campaign",
    fields:
      "campaign_id,campaign_name,date_start,date_stop,impressions,reach,clicks,spend,ctr,cpc,account_currency,actions,cost_per_action_type",
    date_preset: datePreset,
    filtering: JSON.stringify([
      { field: "campaign.delivery_info", operator: "IN", value: ["active"] },
    ]),
  });
}
