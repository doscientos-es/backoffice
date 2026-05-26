-- ============================================================
-- Leads: valor estimado del pipeline
-- ============================================================
-- Permite asignar un importe esperado a cada lead para calcular el valor
-- total del pipeline por etapa (Kanban) y priorizar oportunidades.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS estimated_value numeric(12,2);
