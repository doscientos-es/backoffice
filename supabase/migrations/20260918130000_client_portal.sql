-- Authenticated, passwordless client portal.
create table if not exists public.client_portal_access (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  email citext not null,
  portal_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, email)
);

create index if not exists client_portal_access_user_idx on public.client_portal_access(user_id)
  where enabled = true;
alter table public.client_portal_access enable row level security;

drop policy if exists client_portal_access_self on public.client_portal_access;
create policy client_portal_access_self on public.client_portal_access
  for select to authenticated
  using ((select auth.uid()) = user_id and enabled = true);

grant select on public.client_portal_access to authenticated;

grant select (portal_token, enabled) on public.client_portal_access to anon;
drop policy if exists client_portal_token_lookup on public.client_portal_access;
create policy client_portal_token_lookup on public.client_portal_access
  for select to anon using (enabled = true);

drop policy if exists client_portal_data_projects on public.projects;
create policy client_portal_data_projects on public.projects
  for select to authenticated
  using (exists (
    select 1 from public.client_portal_access access
    where access.client_id = projects.client_id
      and access.user_id = (select auth.uid())
      and access.enabled = true
  ) and deleted_at is null);

drop policy if exists client_portal_data_proposals on public.proposals;
create policy client_portal_data_proposals on public.proposals
  for select to authenticated
  using (exists (
    select 1 from public.client_portal_access access
    where access.client_id = proposals.client_id
      and access.user_id = (select auth.uid())
      and access.enabled = true
  ) and deleted_at is null and status <> 'draft');

drop policy if exists client_portal_data_invoices on public.invoices;
create policy client_portal_data_invoices on public.invoices
  for select to authenticated
  using (exists (
    select 1 from public.client_portal_access access
    where access.client_id = invoices.client_id
      and access.user_id = (select auth.uid())
      and access.enabled = true
  ) and deleted_at is null and status <> 'draft');
