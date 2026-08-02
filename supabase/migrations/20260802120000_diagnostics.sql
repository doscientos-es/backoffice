-- Personalized diagnostic flow: answers, calculated impact, report delivery and lead link.
CREATE TABLE IF NOT EXISTS public.diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  company text,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed',
  access_token text NOT NULL UNIQUE,
  report_sent_at timestamptz,
  report_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS diagnostics_lead_idx ON public.diagnostics (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diagnostics_email_idx ON public.diagnostics (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS diagnostics_token_idx ON public.diagnostics (access_token);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS latest_diagnostic_id uuid REFERENCES public.diagnostics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diagnostic_completed_at timestamptz;
