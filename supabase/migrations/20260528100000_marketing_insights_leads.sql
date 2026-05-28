-- ============================================================
-- Marketing Insights: Meta-attributed lead metrics
-- ============================================================
-- Stores leads and CPL extracted from Meta's `actions` /
-- `cost_per_action_type` fields, replacing the fragile UTM-based
-- attribution previously used in the dashboard query.

ALTER TABLE public.marketing_insights
  ADD COLUMN IF NOT EXISTS total_leads int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_per_lead numeric;

-- Useful for "active ads" dashboard aggregations
CREATE INDEX IF NOT EXISTS idx_marketing_insights_ad ON public.marketing_insights(ad_id);
