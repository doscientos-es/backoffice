-- ============================================================
-- Permission catalog + scoped RLS.
--
-- 1. role_permissions: which permissions each role grants. Must stay in
--    sync with ROLE_PERMISSIONS in lib/permissions.ts.
-- 2. has_permission() / member_has_full_scope() / is_assigned_*() /
--    can_access_*(): helpers used by policies and RPCs.
-- 3. Write policies that hard-coded ('owner','admin','member') now
--    check the module permission, so new roles work without edits.
-- 4. Read policies of CRM/delivery tables honour access_scope; finance,
--    marketing and vault reads require their module permission.
-- ============================================================

-- ---- 1. Catalog ----
create table if not exists public.role_permissions (
  role       public.member_role not null,
  permission text               not null,
  primary key (role, permission)
);

alter table public.role_permissions enable row level security;

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select using (public.is_team_member());

delete from public.role_permissions;

insert into public.role_permissions (role, permission)
select r.role::public.member_role, p.permission
from (values
  ('owner', array[
    'leads.read','leads.write','leads.delete',
    'clients.read','clients.write','clients.delete',
    'proposals.read','proposals.write','proposals.delete','proposals.prices',
    'projects.read','projects.write','projects.delete',
    'tasks.read','tasks.write','tasks.delete',
    'finance.read','finance.write',
    'marketing.read','marketing.write',
    'vault.read','vault.write',
    'workspace.write','team.manage','settings.manage']),
  ('admin', array[
    'leads.read','leads.write','leads.delete',
    'clients.read','clients.write','clients.delete',
    'proposals.read','proposals.write','proposals.delete','proposals.prices',
    'projects.read','projects.write','projects.delete',
    'tasks.read','tasks.write','tasks.delete',
    'finance.read','finance.write',
    'marketing.read','marketing.write',
    'vault.read','vault.write',
    'workspace.write','team.manage','settings.manage']),
  ('member', array[
    'leads.read','leads.write',
    'clients.read','clients.write',
    'proposals.read','proposals.write','proposals.prices',
    'projects.read','projects.write',
    'tasks.read','tasks.write',
    'workspace.write']),
  ('sales', array[
    'leads.read','leads.write',
    'clients.read','clients.write',
    'proposals.read','proposals.write','proposals.prices',
    'projects.read',
    'tasks.read','tasks.write',
    'workspace.write']),
  ('delivery', array[
    'clients.read',
    'proposals.read',
    'projects.read','projects.write',
    'tasks.read','tasks.write',
    'workspace.write']),
  ('accountant', array[
    'clients.read','clients.write',
    'proposals.read','proposals.prices',
    'projects.read',
    'tasks.read',
    'finance.read','finance.write',
    'workspace.write']),
  ('viewer', array[
    'leads.read',
    'clients.read',
    'proposals.read','proposals.prices',
    'projects.read',
    'tasks.read'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- ---- 2. Helpers ----
create or replace function public.has_permission(p_permission text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.role_permissions rp on rp.role = tm.role
    where tm.id = auth.uid() and tm.deleted_at is null and rp.permission = p_permission
  )
$$;

create or replace function public.member_has_full_scope()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select tm.role in ('owner', 'admin') or tm.access_scope = 'all'
    from public.team_members tm
    where tm.id = auth.uid() and tm.deleted_at is null
  ), false)
$$;

create or replace function public.is_assigned_lead(p_lead_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid())
  )
$$;

create or replace function public.is_assigned_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.project_id = p_project_id
      and t.deleted_at is null
      and (
        t.assignee_id = auth.uid()
        or exists (
          select 1 from public.task_members m where m.task_id = t.id and m.member_id = auth.uid()
        )
      )
  )
$$;


create or replace function public.is_assigned_proposal(p_proposal_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.proposals p
    where p.id = p_proposal_id
      and (
        p.created_by = auth.uid()
        or exists (
          select 1 from public.proposal_team_members m
          where m.proposal_id = p.id and m.member_id = auth.uid()
        )
        or (p.lead_id is not null and public.is_assigned_lead(p.lead_id))
        or (p.project_id is not null and public.is_assigned_project(p.project_id))
      )
  )
$$;

create or replace function public.is_assigned_client(p_client_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.lead_id is not null and public.is_assigned_lead(c.lead_id)
    )
    or exists (
      select 1 from public.projects pr
      where pr.client_id = p_client_id and pr.deleted_at is null
        and public.is_assigned_project(pr.id)
    )
    or exists (
      select 1 from public.proposals p
      where p.client_id = p_client_id and p.deleted_at is null
        and public.is_assigned_proposal(p.id)
    )
    or exists (
      select 1 from public.tasks t
      where t.client_id = p_client_id and t.deleted_at is null
        and (t.assignee_id = auth.uid() or t.created_by = auth.uid())
    )
$$;

create or replace function public.is_assigned_task(p_task_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = p_task_id
      and (
        t.assignee_id = auth.uid()
        or t.created_by = auth.uid()
        or exists (
          select 1 from public.task_members m where m.task_id = t.id and m.member_id = auth.uid()
        )
        or (t.project_id is not null and public.is_assigned_project(t.project_id))
        or (t.lead_id is not null and public.is_assigned_lead(t.lead_id))
      )
  )
$$;

-- Module permission + scope in one call. Policies on large tables inline
-- the same logic with `(select ...)` so permission/scope are evaluated once
-- per statement instead of once per row.
create or replace function public.can_access_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_permission('leads.read') and (public.member_has_full_scope() or public.is_assigned_lead(p_lead_id)) $$;

create or replace function public.can_access_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_permission('clients.read') and (public.member_has_full_scope() or public.is_assigned_client(p_client_id)) $$;

create or replace function public.can_access_proposal(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_permission('proposals.read') and (public.member_has_full_scope() or public.is_assigned_proposal(p_proposal_id)) $$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_permission('projects.read') and (public.member_has_full_scope() or public.is_assigned_project(p_project_id)) $$;

create or replace function public.can_access_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.has_permission('tasks.read') and (public.member_has_full_scope() or public.is_assigned_task(p_task_id)) $$;

-- Rows that may point to a lead, client, project and/or proposal. Visible
-- when any linked record is accessible; unlinked rows stay team-wide.
create or replace function public.can_access_related(
  p_lead_id uuid, p_client_id uuid, p_project_id uuid, p_proposal_id uuid
)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select case
    when p_lead_id is null and p_client_id is null and p_project_id is null and p_proposal_id is null
      then public.is_team_member()
    else
      (p_lead_id is not null and public.can_access_lead(p_lead_id))
      or (p_client_id is not null and public.can_access_client(p_client_id))
      or (p_project_id is not null and public.can_access_project(p_project_id))
      or (p_proposal_id is not null and public.can_access_proposal(p_proposal_id))
  end
$$;
