-- ============================================================
-- Leads: nuevo estado 'not_interested'
-- ============================================================
-- Columna kanban para leads descartados activamente (no contestan,
-- oferta inviable, fit incorrecto…). Distinto de 'lost' (oportunidad
-- perdida tras intentarlo) y de 'archived' (papelera).

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'not_interested';
