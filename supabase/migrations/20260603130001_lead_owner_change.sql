-- ============================================================
-- Leads: owner_change en interaction_type
-- ============================================================
-- owner_change: nuevo valor en interaction_type para que la acción
-- assignLeadOwner pueda logear la (re)asignación de responsable en
-- lead_interactions con performed_by, preservando el historial de
-- quién pasó a ocuparse del lead y cuándo.
-- ============================================================

ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'owner_change';
