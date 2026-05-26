-- ============================================================
-- proposal_views: registro detallado de aperturas de propuestas
-- ============================================================
-- Cada vez que se abre /p/proposal/[token] (cliente) o el preview
-- interno (team) se inserta una fila. Permite ver cuántas veces
-- y cuándo se ha consultado la propuesta, distinguiendo viewer_type.

create type public.proposal_viewer_type as enum ('team', 'client');

create table if not exists public.proposal_views (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  viewer_type public.proposal_viewer_type not null,
  team_member_id uuid references public.team_members(id) on delete set null,
  ip text,
  user_agent text,
  viewed_at timestamptz not null default now()
);

create index if not exists proposal_views_proposal_idx
  on public.proposal_views(proposal_id, viewed_at desc);

create index if not exists proposal_views_client_idx
  on public.proposal_views(proposal_id) where viewer_type = 'client';

-- RLS: solo lectura para team_members. Las inserciones se hacen
-- siempre con el cliente admin (service_role) desde el servidor.
alter table public.proposal_views enable row level security;

drop policy if exists "proposal_views_select" on public.proposal_views;
create policy "proposal_views_select" on public.proposal_views
  for select using (public.is_team_member());
