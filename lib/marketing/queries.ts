import { createServerClient } from "@/lib/supabase/server";
import { notDeleted } from "@/lib/supabase/filters";
import type { MarketingOverview, ActiveAdRow, RawAdRow } from "./types";

export async function getActiveAdsOverview(): Promise<MarketingOverview> {
  const supabase = await createServerClient();

  // Get active ads and their basic stats
  const { data: adsData } = await notDeleted(
    supabase
      .from("marketing_ads")
      .select(`
      id,
      name,
      status,
      preview_url,
      marketing_campaigns (name),
      marketing_insights (spend, impressions, clicks)
    `)
      .eq("status", "ACTIVE"),
  );

  const ads = (adsData as unknown as RawAdRow[]) || [];

  // Get lead counts per ad_id
  const { data: leadsByAd } = await supabase
    .from("leads")
    .select("utm_content")
    .not("utm_content", "is", null);

  const leadCounts = (leadsByAd || []).reduce((acc: Record<string, number>, lead) => {
    const adId = lead.utm_content as string;
    acc[adId] = (acc[adId] || 0) + 1;
    return acc;
  }, {});

  // Calculate totals
  const processedAds: ActiveAdRow[] = ads.map(ad => {
    const insights = ad.marketing_insights || [];
    const totalSpend = insights.reduce((sum, i) => sum + (i.spend || 0), 0);
    const totalLeads = leadCounts[ad.id] || 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    const campaign = Array.isArray(ad.marketing_campaigns)
      ? ad.marketing_campaigns[0]
      : ad.marketing_campaigns;

    return {
      id: ad.id,
      name: ad.name,
      status: ad.status || "UNKNOWN",
      preview_url: ad.preview_url || null,
      campaignName: campaign?.name || "Sin campaña",
      spend: totalSpend,
      leads: totalLeads,
      cpl
    };
  });

  const totalSpent = processedAds.reduce((sum, ad) => sum + ad.spend, 0);
  const totalLeads = Object.values(leadCounts).reduce((sum, c) => sum + c, 0);
  const avgCpl = totalLeads > 0 ? totalSpent / totalLeads : 0;

  return {
    ads: processedAds,
    totalSpent,
    totalLeads,
    avgCpl
  };
}
