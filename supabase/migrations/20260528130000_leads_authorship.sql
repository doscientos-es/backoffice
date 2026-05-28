-- ============================================================
-- Leads: autoría (created_by / updated_by) + status_change
-- ============================================================
-- created_by: miembro que creó el lead (en backoffice o vía intake).
-- updated_by: último miembro que modificó el lead.
-- Ambas son nullable para no romper leads existentes ni los leads
-- captados automáticamente desde webhooks sin sesión de usuario.
--
-- status_change: nuevo valor en interaction_type para que
-- updateLeadStatus pueda logear el cambio en lead_interactions
-- con performed_by, preservando el historial completo del funnel.
-- ============================================================

-- Columnas de autoría en leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_created_by_idx ON public.leads(created_by) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS leads_updated_by_idx ON public.leads(updated_by) WHERE deleted_at IS NULL;

-- Nuevo valor en el enum para log de cambios de estado
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'status_change';
