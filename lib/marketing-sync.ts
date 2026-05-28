import { scopedLogger } from "@/lib/logger";

const log = scopedLogger("marketing-sync");
import { createAdminClient } from "@/lib/supabase/admin";
import * as MetaAPI from "./integrations/meta-marketing";

/**
 * Full sync of Campaigns, Ad Sets and Ads from Meta.
 */
export async function syncMetaCatalog() {
  const supabase = createAdminClient();

  try {
    const [campaigns, adsets, ads] = await Promise.all([
      MetaAPI.getMetaCampaigns(),
      MetaAPI.getMetaAdSets(),
      MetaAPI.getMetaAds(),
    ]);

    // Upsert Campaigns
    if (campaigns.length > 0) {
      const { error: cErr } = await supabase.from("marketing_campaigns").upsert(
        campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          objective: c.objective,
          buying_type: c.buying_type,
          start_time: c.start_time,
          stop_time: c.stop_time,
          raw_payload: c,
        })),
      );
      if (cErr) throw cErr;
    }

    // Upsert Ad Sets
    if (adsets.length > 0) {
      const { error: asErr } = await supabase.from("marketing_ad_sets").upsert(
        adsets.map((as) => ({
          id: as.id,
          campaign_id: as.campaign_id,
          name: as.name,
          status: as.status,
          billing_event: as.billing_event,
          optimization_goal: as.optimization_goal,
          daily_budget: as.daily_budget ? Number.parseFloat(as.daily_budget) / 100 : null,
          lifetime_budget: as.lifetime_budget ? Number.parseFloat(as.lifetime_budget) / 100 : null,
          raw_payload: as,
        })),
      );
      if (asErr) throw asErr;
    }

    // Upsert Ads
    if (ads.length > 0) {
      const { error: aErr } = await supabase.from("marketing_ads").upsert(
        ads.map((a) => ({
          id: a.id,
          adset_id: a.adset_id,
          campaign_id: a.campaign_id,
          name: a.name,
          status: a.status,
          preview_url: a.creative?.thumbnail_url,
          raw_payload: a,
        })),
      );
      if (aErr) throw aErr;
    }

    return {
      ok: true,
      synced: { campaigns: campaigns.length, adsets: adsets.length, ads: ads.length },
    };
  } catch (err) {
    log.error({ err }, "syncMetaCatalog failed");
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sync daily insights for a given range.
 */
export async function syncMetaInsights(since: string, until: string) {
  const supabase = createAdminClient();

  try {
    const insights = await MetaAPI.getMetaInsights(since, until);
    if (insights.length === 0) return { ok: true, synced: 0 };

    const { error } = await supabase.from("marketing_insights").upsert(
      insights.map((i) => ({
        ad_id: i.ad_id,
        date_start: i.date_start,
        date_stop: i.date_stop,
        impressions: Number.parseInt(i.impressions),
        reach: Number.parseInt(i.reach),
        clicks: Number.parseInt(i.clicks),
        spend: Number.parseFloat(i.spend),
        ctr: Number.parseFloat(i.ctr),
        cpc: i.cpc ? Number.parseFloat(i.cpc) : null,
        cpp: i.cpp ? Number.parseFloat(i.cpp) : null,
      })),
      { onConflict: "ad_id,date_start" },
    );

    if (error) throw error;
    return { ok: true, synced: insights.length };
  } catch (err) {
    log.error({ err }, "syncMetaInsights failed");
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
