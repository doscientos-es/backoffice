-- Persist the AI's suggested follow-up time so scheduling can use it after
-- refreshes and not silently fall back to the generic one-hour preset.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_suggested_next_step_at timestamptz;