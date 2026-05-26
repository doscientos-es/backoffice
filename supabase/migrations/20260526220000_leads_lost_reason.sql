-- ============================================================
-- Leads: motivo de pérdida + timestamp terminal
-- ============================================================
-- Captura por qué se perdió un lead (para analítica de funnel) y la fecha
-- en la que entró en estado terminal. Se rellena/limpia desde la acción
-- updateLeadStatus cuando el estado pasa a/desde 'lost'.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_at     timestamptz;

CREATE INDEX IF NOT EXISTS leads_lost_at_idx ON public.leads (lost_at)
  WHERE lost_at IS NOT NULL;
