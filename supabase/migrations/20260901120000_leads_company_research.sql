-- Lead company research is kept separate from user-submitted CRM fields so it
-- remains traceable, refreshable and safe to review before commercial use.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_research jsonb,
  ADD COLUMN IF NOT EXISTS company_researched_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_company_researched_at_idx
  ON public.leads (company_researched_at DESC)
  WHERE deleted_at IS NULL AND company_researched_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';