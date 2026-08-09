-- Keep an explicit provenance for the accessibility signal so call-based
-- automation can help without ever overwriting a sales rep's judgement.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mom_test_accessible_source text;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_mom_test_accessible_source_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_mom_test_accessible_source_check
  CHECK (mom_test_accessible_source IS NULL OR mom_test_accessible_source IN ('auto', 'manual'));

-- Existing non-empty values were entered before automation existed, so they
-- must be treated as manual decisions from the outset.
UPDATE public.leads
SET mom_test_accessible_source = 'manual'
WHERE mom_test_accessible IS NOT NULL
  AND mom_test_accessible_source IS NULL;