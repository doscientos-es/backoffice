-- ============================================================
-- Meta Marketing API integration
-- ============================================================

-- Campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id text PRIMARY KEY, -- Meta Campaign ID
  name text NOT NULL,
  status text,
  objective text,
  buying_type text,
  start_time timestamptz,
  stop_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb
);

-- Ad Sets
CREATE TABLE IF NOT EXISTS public.marketing_ad_sets (
  id text PRIMARY KEY, -- Meta Ad Set ID
  campaign_id text REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text,
  billing_event text,
  optimization_goal text,
  daily_budget numeric,
  lifetime_budget numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb
);

-- Ads
CREATE TABLE IF NOT EXISTS public.marketing_ads (
  id text PRIMARY KEY, -- Meta Ad ID
  adset_id text REFERENCES public.marketing_ad_sets(id) ON DELETE CASCADE,
  campaign_id text REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text,
  preview_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_payload jsonb
);

-- Daily Insights (Historical snapshots)
CREATE TABLE IF NOT EXISTS public.marketing_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id text REFERENCES public.marketing_ads(id) ON DELETE CASCADE,
  date_start date NOT NULL,
  date_stop date NOT NULL,
  impressions int DEFAULT 0,
  reach int DEFAULT 0,
  clicks int DEFAULT 0,
  spend numeric DEFAULT 0,
  currency text DEFAULT 'EUR',
  ctr numeric,
  cpc numeric,
  cpp numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_id, date_start)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_marketing_insights_date ON public.marketing_insights(date_start DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ads_campaign ON public.marketing_ads(campaign_id);

-- Enable RLS
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_insights ENABLE ROW LEVEL SECURITY;

-- Simple policies for now (only authenticated users can see marketing data)
CREATE POLICY "Allow authenticated users to read marketing data"
  ON public.marketing_campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read marketing data"
  ON public.marketing_ad_sets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read marketing data"
  ON public.marketing_ads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read marketing data"
  ON public.marketing_insights FOR SELECT
  TO authenticated
  USING (true);
