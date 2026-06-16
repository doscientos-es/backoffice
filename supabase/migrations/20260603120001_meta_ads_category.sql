-- ============================================================
-- Dedicated expense category for Meta Ads account top-ups
-- ============================================================
-- 'marketing' is too broad (it also covers sponsorships, content,
-- design, etc.). A dedicated 'meta_ads' category lets the Meta Ads
-- balance widget sum account recharges precisely:
--   saldo = Σ(expenses category=meta_ads) − Σ(marketing_insights.spend)

ALTER TYPE public.expense_category ADD VALUE IF NOT EXISTS 'meta_ads' AFTER 'marketing';
