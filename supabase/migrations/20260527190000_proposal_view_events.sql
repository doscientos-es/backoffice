-- ============================================================
-- Unify proposal_views + proposal_slide_views → proposal_view_events
-- ============================================================
-- Before: two separate tables for page-level opens and per-slide tracking.
-- After:  one table. Slide-level rows have session_id/slide_* populated;
--         page-level rows leave those fields NULL.
-- ============================================================

create table if not exists public.proposal_view_events (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references public.proposals(id) on delete cascade,
  viewed_at      timestamptz not null default now(),
  viewer_type    public.proposal_viewer_type not null,
  team_member_id uuid references public.team_members(id) on delete set null,
  ip             text,
  user_agent     text,
  -- slide-level fields (NULL for page-level opens)
  session_id     text,
  slide_key      text,
  slide_index    int,
  total_slides   int,
  dwell_ms       int,
  is_final       boolean
);

-- Fast listing for the "Aperturas recientes" card in the proposal detail page.
create index if not exists proposal_view_events_proposal_idx
  on public.proposal_view_events(proposal_id, viewed_at desc);

-- Filter for slide analytics (heatmap, engagement score).
create index if not exists proposal_view_events_session_idx
  on public.proposal_view_events(proposal_id, session_id)
  where session_id is not null;

-- ---- RLS ----
alter table public.proposal_view_events enable row level security;

-- Team members can read; inserts are always from service_role (admin client).
drop policy if exists "proposal_view_events_select" on public.proposal_view_events;
create policy "proposal_view_events_select" on public.proposal_view_events
  for select using (public.is_team_member());

-- ---- Migrate existing data ----
insert into public.proposal_view_events
  (id, proposal_id, viewed_at, viewer_type, team_member_id, ip, user_agent)
select id, proposal_id, viewed_at, viewer_type, team_member_id, ip, user_agent
from public.proposal_views
on conflict (id) do nothing;

insert into public.proposal_view_events
  (id, proposal_id, viewed_at, viewer_type, user_agent,
   session_id, slide_key, slide_index, total_slides, dwell_ms, is_final)
select id, proposal_id, created_at, viewer_type, user_agent,
       session_id, slide_key, slide_index, total_slides, dwell_ms, is_final
from public.proposal_slide_views
on conflict (id) do nothing;

-- ---- Drop superseded tables ----
drop table if exists public.proposal_slide_views;
drop table if exists public.proposal_views;
