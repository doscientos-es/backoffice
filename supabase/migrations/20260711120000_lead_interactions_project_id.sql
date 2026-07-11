-- ============================================================
-- lead_interactions: optional project link
-- ============================================================
-- Allows a meeting/call interaction to be associated with a
-- specific project (e.g. the Google Meet was about project X).
-- The FK is nullable and soft-safe (on delete set null).

alter table public.lead_interactions
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists lead_interactions_project_idx
  on public.lead_interactions(project_id)
  where project_id is not null;
