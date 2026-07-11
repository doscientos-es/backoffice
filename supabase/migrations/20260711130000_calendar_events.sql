-- Feature: Calendar events (charlas / eventos)
-- Standalone team events (talks, workshops, external programs) that are shared
-- across multiple team members. Unlike tasks/reminders (single owner) or Google
-- meetings (external, not persisted), these are first-class rows with a list of
-- attending team members via event_attendees.

-- ─── events ───────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  description text,
  location    text,
  url         text,
  start_at    timestamptz not null,
  end_at      timestamptz,
  all_day     boolean     not null default false,
  created_by  uuid        references public.team_members(id) on delete set null,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_start_idx on public.events(start_at) where deleted_at is null;

-- ─── event_attendees ──────────────────────────────────────────────────────────
create table if not exists public.event_attendees (
  event_id  uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  primary key (event_id, member_id)
);

create index if not exists event_attendees_member_idx on public.event_attendees(member_id);

-- ─── updated_at trigger ─────────────────────────────────────────────────────────
drop trigger if exists trg_touch_events on public.events;
create trigger trg_touch_events
  before update on public.events
  for each row execute function public.fn_touch_updated_at();

-- ─── RLS: events ────────────────────────────────────────────────────────────────
alter table public.events enable row level security;

drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select using (public.is_team_member());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete using (public.current_member_role() in ('owner', 'admin'));

-- ─── RLS: event_attendees ───────────────────────────────────────────────────────
alter table public.event_attendees enable row level security;

drop policy if exists event_attendees_select on public.event_attendees;
create policy event_attendees_select on public.event_attendees
  for select using (public.is_team_member());

drop policy if exists event_attendees_insert on public.event_attendees;
create policy event_attendees_insert on public.event_attendees
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists event_attendees_update on public.event_attendees;
create policy event_attendees_update on public.event_attendees
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists event_attendees_delete on public.event_attendees;
create policy event_attendees_delete on public.event_attendees
  for delete using (public.current_member_role() in ('owner', 'admin', 'member'));
