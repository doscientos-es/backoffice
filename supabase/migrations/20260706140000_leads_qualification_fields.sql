-- ============================================================
-- Leads: campos de cualificación comercial
-- ============================================================
-- Promueve datos clave del formulario (hoy atrapados en texto libre dentro
-- de `notes`) a columnas estructuradas para poder puntuar, filtrar y ordenar
-- el Kanban por criterios que predicen el cierre:
--   company_size      → tamaño de empresa ("10-50 empleados")
--   solution_type     → qué solución necesita ("Software a medida")
--   urgency           → cuándo necesita empezar ("Inmediata", "Este mes"…)
--   first_contacted_at → speed-to-lead (momento del primer contacto saliente)

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS company_size       text,
  ADD COLUMN IF NOT EXISTS solution_type      text,
  ADD COLUMN IF NOT EXISTS urgency            text,
  ADD COLUMN IF NOT EXISTS first_contacted_at timestamptz;

-- Índice parcial para el filtro "leads calientes sin contactar" del panel.
CREATE INDEX IF NOT EXISTS leads_uncontacted_idx
  ON public.leads (created_at)
  WHERE first_contacted_at IS NULL AND deleted_at IS NULL;
