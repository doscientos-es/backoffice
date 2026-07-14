-- ============================================================
-- Leads: corregir los criterios del checklist Mom Test
-- ============================================================
-- Sustituye "ha buscado soluciones" y la separación artificial entre
-- presupuesto/conocimiento del presupuesto por los 5 criterios acordados:
-- problema real, consciencia, intentos previos, poder de decisión o
-- presupuesto, y accesibilidad.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS mom_test_real_problem boolean,
  ADD COLUMN IF NOT EXISTS mom_test_decision_power_or_budget boolean,
  ADD COLUMN IF NOT EXISTS mom_test_accessible boolean;

-- Conserva los datos de la primera versión cuando exista información.
UPDATE public.leads
SET
  mom_test_decision_power_or_budget = CASE
    WHEN mom_test_has_budget IS TRUE OR mom_test_knows_budget IS TRUE THEN TRUE
    WHEN mom_test_has_budget IS FALSE AND mom_test_knows_budget IS FALSE THEN FALSE
    ELSE NULL
  END,
  mom_test_tried_solutions = COALESCE(mom_test_tried_solutions, mom_test_searched_solutions)
WHERE mom_test_has_budget IS NOT NULL
   OR mom_test_knows_budget IS NOT NULL
   OR mom_test_searched_solutions IS NOT NULL;

ALTER TABLE public.leads
  DROP COLUMN IF EXISTS mom_test_searched_solutions,
  DROP COLUMN IF EXISTS mom_test_has_budget,
  DROP COLUMN IF EXISTS mom_test_knows_budget;