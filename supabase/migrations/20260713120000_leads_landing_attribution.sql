-- Structured attribution from the public landing form.
-- These fields keep campaign/page/calculator context queryable instead of
-- burying it in `notes`.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS landing_path     text,
  ADD COLUMN IF NOT EXISTS landing_ref      text,
  ADD COLUMN IF NOT EXISTS landing_subject  text,
  ADD COLUMN IF NOT EXISTS calculator_cost  text,
  ADD COLUMN IF NOT EXISTS calculator_hours text;

CREATE INDEX IF NOT EXISTS leads_landing_path_idx
  ON public.leads (landing_path)
  WHERE deleted_at IS NULL AND landing_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_landing_ref_idx
  ON public.leads (landing_ref)
  WHERE deleted_at IS NULL AND landing_ref IS NOT NULL;
