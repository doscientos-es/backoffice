-- Feature: Web Projects
-- Tracks websites managed by doscientos: own sites and client sites.
-- Stores hosting, domain, tech stack info + links to clients.

create table if not exists public.web_projects (
  id                 uuid        primary key default gen_random_uuid(),
  name               text        not null,
  url                text        not null,
  client_id          uuid        references public.clients(id) on delete set null,
  is_own             boolean     not null default false,
  hosting_provider   text,
  hosting_url        text,
  domain_registrar   text,
  domain_expires_at  date,
  tech_stack         text[]      not null default '{}',
  notes              text,
  deleted_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists web_projects_client_idx on public.web_projects(client_id)
  where deleted_at is null;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.web_projects enable row level security;

drop policy if exists web_projects_select on public.web_projects;
create policy web_projects_select on public.web_projects
  for select using (public.is_team_member());

drop policy if exists web_projects_insert on public.web_projects;
create policy web_projects_insert on public.web_projects
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists web_projects_update on public.web_projects;
create policy web_projects_update on public.web_projects
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists web_projects_delete on public.web_projects;
create policy web_projects_delete on public.web_projects
  for delete using (public.current_member_role() in ('owner', 'admin'));
