export type MarketingOverview = {
  ads: ActiveAdRow[];
  totalSpent: number;
  totalLeads: number;
  avgCpl: number;
};

export type ActiveAdRow = {
  id: string;
  name: string;
  status: string;
  preview_url: string | null;
  campaignName: string;
  spend: number;
  leads: number;
  cpl: number;
};

export interface RawAdRow {
  id: string;
  name: string;
  status: string | null;
  preview_url: string | null;
  marketing_campaigns: { name: string | null } | { name: string | null }[] | null;
  marketing_insights: { spend: number | null; impressions: number | null; clicks: number | null }[] | null;
}
