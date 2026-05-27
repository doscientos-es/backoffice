import { serverEnv } from "@/lib/env";

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

export interface MetaMarketingInsight {
  ad_id: string;
  date_start: string;
  date_stop: string;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc?: string;
  cpp?: string;
}

// ---------------- API Calls ----------------

async function fetchMetaMarketing<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const env = serverEnv();
  const token = env.META_USER_ACCESS_TOKEN || env.META_PAGE_ACCESS_TOKEN;

  if (!token) {
    throw new Error("Meta Access Token (User or Page) not configured");
  }

  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${path}`);
  url.searchParams.set("access_token", token);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Meta API Error ${res.status}: ${errorBody.slice(0, 500)}`);
  }

  const data = await res.json();
  return (data.data || []) as T[];
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
 * Fetch insights for a specific time range.
 * Default is last 30 days.
 */
export async function getMetaInsights(
  since: string,
  until: string,
): Promise<MetaMarketingInsight[]> {
  const env = serverEnv();
  if (!env.META_AD_ACCOUNT_ID) throw new Error("META_AD_ACCOUNT_ID not configured");

  return fetchMetaMarketing<MetaMarketingInsight>(`${env.META_AD_ACCOUNT_ID}/insights`, {
    level: "ad",
    fields: "ad_id,date_start,date_stop,impressions,reach,clicks,spend,ctr,cpc,cpp",
    time_range: JSON.stringify({ since, until }),
  });
}
