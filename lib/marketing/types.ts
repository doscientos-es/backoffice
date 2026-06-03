export type MarketingOverview = {
  ads: ActiveAdRow[];
  totalSpent: number;
  totalLeads: number;
  totalImpressions: number;
  totalClicks: number;
  avgCpl: number;
  avgCtr: number;
  avgCpc: number;
  currency: string;
  lastSyncAt: string | null;
};

export type ActiveAdRow = {
  id: string;
  name: string;
  status: string;
  preview_url: string | null;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
  currency: string;
};

/**
 * One day of account-wide aggregated insights, used to feed the evolution chart.
 */
export type InsightsTimePoint = {
  date: string;
  spend: number;
  leads: number;
  clicks: number;
  impressions: number;
};

export interface RawInsightRow {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  total_leads: number | null;
  cost_per_lead: number | null;
  currency: string | null;
  date_start: string | null;
  date_stop: string | null;
}

type RawCampaign = {
  id: string | null;
  name: string | null;
  status: string | null;
  objective: string | null;
};

export interface RawAdRow {
  id: string;
  name: string;
  status: string | null;
  preview_url: string | null;
  updated_at: string | null;
  campaign_id: string | null;
  marketing_campaigns: RawCampaign | RawCampaign[] | null;
  marketing_insights: RawInsightRow[] | null;
}

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  objective: string | null;
  adCount: number;
  activeAdCount: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
  currency: string;
};

export type CampaignsOverview = {
  campaigns: CampaignRow[];
  totalSpent: number;
  totalLeads: number;
  totalImpressions: number;
  totalClicks: number;
  avgCpl: number;
  avgCtr: number;
  avgCpc: number;
  currency: string;
  lastSyncAt: string | null;
};
