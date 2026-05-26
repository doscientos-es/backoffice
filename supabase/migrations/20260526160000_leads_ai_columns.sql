-- ============================================================
-- Leads: columnas para el asistente de IA (sec. 22 description.md)
-- ============================================================
-- ai_summary ya existe desde el init. Aquí añadimos el resto de campos
-- que el endpoint /api/crm/ai/summarize-lead persiste tras cada análisis.
--
-- ai_temperature reutiliza el enum lead_temperature ('hot'|'warm'|'cold')
-- para mantener consistencia con la columna manual `temperature`.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ai_suggested_next_step text,
  ADD COLUMN IF NOT EXISTS ai_temperature         public.lead_temperature,
  ADD COLUMN IF NOT EXISTS ai_confidence          numeric(3,2),
  ADD COLUMN IF NOT EXISTS ai_updated_at          timestamptz;

-- Indice util para dashboards que filtren por temperatura sugerida por IA.
CREATE INDEX IF NOT EXISTS leads_ai_temperature_idx
  ON public.leads (ai_temperature)
  WHERE deleted_at IS NULL AND ai_temperature IS NOT NULL;
