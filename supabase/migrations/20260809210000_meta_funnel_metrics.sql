-- Meta paid-traffic funnel: keep the meaningful post-impression metrics and
-- enough creative context to audit each ad's real destination and CTA.

ALTER TABLE public.marketing_insights
  ADD COLUMN IF NOT EXISTS inline_link_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unique_outbound_clicks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_page_views integer NOT NULL DEFAULT 0;

ALTER TABLE public.marketing_ads
  ADD COLUMN IF NOT EXISTS creative_id text,
  ADD COLUMN IF NOT EXISTS destination_url text,
  ADD COLUMN IF NOT EXISTS url_tags text,
  ADD COLUMN IF NOT EXISTS call_to_action_type text,
  ADD COLUMN IF NOT EXISTS lead_form_id text;

CREATE INDEX IF NOT EXISTS idx_marketing_insights_date_ad
  ON public.marketing_insights (date_start DESC, ad_id);

CREATE INDEX IF NOT EXISTS idx_marketing_ads_destination_url
  ON public.marketing_ads (destination_url)
  WHERE destination_url IS NOT NULL;