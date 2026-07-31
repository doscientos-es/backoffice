-- ============================================================
-- Leads: backfill de 'qualifying' a las nuevas etapas factuales
-- ============================================================
-- Va en una migración aparte porque un valor de enum recién añadido no
-- puede usarse hasta que la transacción que lo creó haya hecho commit.
--
-- Reparto:
--   in_conversation -> existe una interacción entrante (email recibido o
--                      reunión), es decir la lead ya respondió
--   contacted       -> el resto (solo hubo contacto saliente o ninguno)
--
-- Las leads sin ningún contacto saliente registrado se dejan en
-- 'contacted' igualmente: estaban en 'qualifying', que ya implicaba
-- trabajo comercial iniciado.

UPDATE leads l
SET status = 'in_conversation'
WHERE l.status = 'qualifying'
  AND EXISTS (
    SELECT 1
    FROM lead_interactions i
    WHERE i.lead_id = l.id
      AND i.type IN ('email_received', 'meeting')
  );

UPDATE leads
SET status = 'contacted'
WHERE status = 'qualifying';
