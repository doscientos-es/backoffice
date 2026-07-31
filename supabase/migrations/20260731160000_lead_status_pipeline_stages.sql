-- ============================================================
-- Leads: etapas factuales del pipeline
-- ============================================================
-- 'qualifying' agrupaba subetapas muy distintas (hay que contactar,
-- esperamos respuesta, estamos hablando…). Se parte en dos estados
-- verificables:
--   contacted       -> hubo un contacto saliente, esperamos respuesta
--   in_conversation -> la lead respondió; conversación viva
-- 'qualifying' se mantiene en el enum como valor legacy: PostgreSQL no
-- permite eliminar valores de un enum y las filas históricas de
-- `lead_interactions.payload` lo referencian.

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'contacted';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'in_conversation';
