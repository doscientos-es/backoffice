-- ============================================================
-- Company goals: monthly targets for key business metrics
-- ============================================================
-- Metrics:
--   leads_new        → integer count of new leads per month
--   revenue          → EUR amount invoiced per month
--   conversion_rate  → fraction 0..1 (e.g. 0.25 = 25%)
--
-- One row per metric (UNIQUE on metric → upsert on conflict).
-- RLS: all team members read; only owner/admin write.
-- ============================================================

create type if not exists public.goal_metric as enum (
  'leads_new',
  'revenue',
  'conversion_rate'
);

create table if not exists public.company_goals (
  id          uuid primary key default gen_random_uuid(),
  metric      public.goal_metric not null unique,
  target      numeric not null check (target > 0),
  created_by  uuid references public.team_members(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.company_goals enable row level security;

create policy "all_team_read_goals" on public.company_goals
  for select to authenticated
  using (public.is_team_member());

create policy "admin_write_goals" on public.company_goals
  for all to authenticated
  using (public.current_member_role() in ('owner', 'admin'))
  with check (public.current_member_role() in ('owner', 'admin'));
