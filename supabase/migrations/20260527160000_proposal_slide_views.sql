-- ============================================================
-- proposal_slide_views: tracking granular de visualización de
-- diapositivas del deck público (/deck/[token]).
-- ============================================================
-- Cada slide visto por el cliente registra una fila con cuánto
-- tiempo permaneció (dwell_ms). Permite:
--   • heatmap por slide (segundos medios / total).
--   • engagement score (% slides vistos).
--   • detectar "lead caliente" (cliente que ve 100% y vuelve).
--   • disparar notificación al equipo cuando llega al cierre.
-- Las inserciones se hacen con createAdminClient (service_role)
-- desde un route handler — el cliente no usa el supabase cliente
-- directamente para evitar exponer la tabla por RLS.

create table if not exists public.proposal_slide_views (
  id           uuid primary key default gen_random_uuid(),
  proposal_id  uuid not null references public.proposals(id) on delete cascade,
  session_id   text not null,
  slide_key    text not null,
  slide_index  int  not null,
  total_slides int  not null,
  dwell_ms     int  not null default 0,
  is_final     boolean not null default false,
  viewer_type  public.proposal_viewer_type not null default 'client',
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists proposal_slide_views_proposal_idx
  on public.proposal_slide_views(proposal_id, created_at desc);

create index if not exists proposal_slide_views_session_idx
  on public.proposal_slide_views(proposal_id, session_id);

create index if not exists proposal_slide_views_client_idx
  on public.proposal_slide_views(proposal_id) where viewer_type = 'client';

-- RLS: lectura para team_members; insert/update se hacen siempre
-- desde el servidor con service_role.
alter table public.proposal_slide_views enable row level security;

drop policy if exists "proposal_slide_views_select" on public.proposal_slide_views;
create policy "proposal_slide_views_select" on public.proposal_slide_views
  for select using (public.is_team_member());
