-- ============================================================
-- Leads: checklist "Mom Test" para detectar leads cualificados
-- ============================================================
-- 5 señales tri-estado (NULL = sin marcar, true = sí, false = no) que el
-- equipo comercial marca durante/después de la llamada de descubrimiento:
--   mom_test_aware_problem      → sabe que tiene el problema
--   mom_test_searched_solutions → ha buscado soluciones antes
--   mom_test_has_budget         → tiene presupuesto
--   mom_test_knows_budget       → conoce el presupuesto (lo sabe)
--   mom_test_tried_solutions    → ha probado otras cosas
-- Todas empiezan vacías (NULL) por defecto.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mom_test_aware_problem      boolean,
  ADD COLUMN IF NOT EXISTS mom_test_searched_solutions boolean,
  ADD COLUMN IF NOT EXISTS mom_test_has_budget         boolean,
  ADD COLUMN IF NOT EXISTS mom_test_knows_budget       boolean,
  ADD COLUMN IF NOT EXISTS mom_test_tried_solutions    boolean;
