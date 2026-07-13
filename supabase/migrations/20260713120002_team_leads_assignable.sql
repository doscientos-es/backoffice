-- ============================================================
-- team_members: flag para excluir miembros del round-robin de leads
-- ============================================================
-- leads_assignable = false → el miembro nunca recibirá leads automáticos.
-- Útil para roles internos (finanzas, etc.) que no gestionan ventas.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS leads_assignable boolean NOT NULL DEFAULT true;
