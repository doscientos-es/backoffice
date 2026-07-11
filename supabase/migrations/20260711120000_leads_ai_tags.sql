-- ============================================================
-- Leads: columna ai_tags para etiquetas generadas por la IA
-- ============================================================

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_tags text[];
