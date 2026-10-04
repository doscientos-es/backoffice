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
create table if not exists public.permissions (
  key         text primary key,
  module      text not null,
  action      text not null,
  label       text not null,
  description text not null
);

create table if not exists public.role_permissions (
  role       public.member_role not null,
  permission text not null references public.permissions(key) on delete cascade,
  primary key (role, permission)
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select using (public.is_team_member());

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select using (public.is_team_member());

insert into public.permissions (key, module, action, label, description) values
  ('leads.read', 'leads', 'read', 'Ver leads', 'Consultar oportunidades comerciales.'),
  ('leads.write', 'leads', 'write', 'Gestionar leads', 'Crear y actualizar oportunidades.'),
  ('leads.delete', 'leads', 'delete', 'Eliminar leads', 'Eliminar oportunidades.'),
  ('clients.read', 'clients', 'read', 'Ver clientes', 'Consultar fichas de clientes.'),
  ('clients.write', 'clients', 'write', 'Gestionar clientes', 'Crear y actualizar fichas de clientes.'),
  ('clients.delete', 'clients', 'delete', 'Eliminar clientes', 'Eliminar fichas de clientes.'),
  ('proposals.read', 'proposals', 'read', 'Ver propuestas', 'Consultar alcance y estado de propuestas.'),
  ('proposals.write', 'proposals', 'write', 'Gestionar propuestas', 'Crear y actualizar propuestas.'),
  ('proposals.delete', 'proposals', 'delete', 'Eliminar propuestas', 'Eliminar propuestas.'),
  ('proposals.prices', 'proposals', 'prices', 'Ver precios', 'Consultar importes y partidas económicas.'),
  ('projects.read', 'projects', 'read', 'Ver proyectos', 'Consultar proyectos.'),
  ('projects.write', 'projects', 'write', 'Gestionar proyectos', 'Crear y actualizar proyectos.'),
  ('projects.delete', 'projects', 'delete', 'Eliminar proyectos', 'Eliminar proyectos.'),
  ('tasks.read', 'tasks', 'read', 'Ver tareas', 'Consultar tareas.'),
  ('tasks.write', 'tasks', 'write', 'Gestionar tareas', 'Crear y actualizar tareas.'),
  ('tasks.delete', 'tasks', 'delete', 'Eliminar tareas', 'Eliminar tareas.'),
  ('finance.read', 'finance', 'read', 'Ver finanzas', 'Consultar facturación, gastos y métricas financieras.'),
  ('finance.write', 'finance', 'write', 'Gestionar finanzas', 'Crear y actualizar registros financieros.'),
  ('marketing.read', 'marketing', 'read', 'Ver marketing', 'Consultar campañas, webs y redes sociales.'),
  ('marketing.write', 'marketing', 'write', 'Gestionar marketing', 'Crear y actualizar contenidos de marketing.'),
  ('vault.read', 'vault', 'read', 'Ver bóveda', 'Consultar elementos de la bóveda.'),
  ('vault.write', 'vault', 'write', 'Gestionar bóveda', 'Crear y actualizar elementos de la bóveda.'),
  ('workspace.write', 'workspace', 'write', 'Colaborar', 'Crear y actualizar elementos operativos compartidos.'),
  ('team.manage', 'team', 'manage', 'Gestionar equipo', 'Invitar y administrar miembros del equipo.'),
  ('settings.manage', 'settings', 'manage', 'Administrar ajustes', 'Cambiar ajustes y configuración del backoffice.')
on conflict (key) do update set
  module = excluded.module,
  action = excluded.action,
  label = excluded.label,
  description = excluded.description;

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
    'proposals.read',
    'projects.read',
    'tasks.read'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- Preserve creator ownership on records without a separate assignee column.
alter table public.clients
  add column if not exists created_by uuid references public.team_members(id) on delete set null;
alter table public.projects
  add column if not exists created_by uuid references public.team_members(id) on delete set null;

-- ---- 2. Helpers ----
create or replace function public.has_permission(p_permission text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid())
  )
$$;

create or replace function public.is_assigned_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
      select 1 from public.projects pr
      where pr.id = p_project_id and pr.created_by = auth.uid()
    )
    or exists (
      select 1 from public.tasks t
      where t.project_id = p_project_id and t.deleted_at is null
        and (t.assignee_id = auth.uid() or t.created_by = auth.uid()
          or exists (
            select 1 from public.task_members m where m.task_id = t.id and m.member_id = auth.uid()
          ))
    )
    or exists (
      select 1 from public.proposals p
      join public.proposal_team_members m on m.proposal_id = p.id
      where p.project_id = p_project_id and p.deleted_at is null and m.member_id = auth.uid()
    )
    or exists (
      select 1 from public.proposals p
      where p.project_id = p_project_id and p.deleted_at is null and p.created_by = auth.uid()
    )
$$;

create or replace function public.is_assigned_proposal(p_proposal_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.clients c
      where c.id = p_client_id and (c.created_by = auth.uid()
        or (c.lead_id is not null and public.is_assigned_lead(c.lead_id)))
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
set search_path = public, pg_temp
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

create or replace function public.can_access_lead(p_lead_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('leads.read') and (public.member_has_full_scope() or public.is_assigned_lead(p_lead_id)) $$;

create or replace function public.can_access_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('clients.read') and (public.member_has_full_scope() or public.is_assigned_client(p_client_id)) $$;

create or replace function public.can_access_proposal(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('proposals.read') and (public.member_has_full_scope() or public.is_assigned_proposal(p_proposal_id)) $$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('projects.read') and (public.member_has_full_scope() or public.is_assigned_project(p_project_id)) $$;

create or replace function public.can_access_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('tasks.read') and (public.member_has_full_scope() or public.is_assigned_task(p_task_id)) $$;

create or replace function public.can_access_related(
  p_lead_id uuid, p_client_id uuid, p_project_id uuid, p_proposal_id uuid
)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_team_member()
    and (p_lead_id is not null or p_client_id is not null or p_project_id is not null
      or p_proposal_id is not null or public.member_has_full_scope())
    and (p_lead_id is null or public.can_access_lead(p_lead_id))
    and (p_client_id is null or public.can_access_client(p_client_id))
    and (p_project_id is null or public.can_access_project(p_project_id))
    and (p_proposal_id is null or public.can_access_proposal(p_proposal_id))
$$;

-- ---- 3. Core records: permission + record assignment ----
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select
  using (public.can_access_lead(id));
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads for insert
  with check (public.has_permission('leads.write') and
    (public.member_has_full_scope() or assigned_to = auth.uid() or created_by = auth.uid()));
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update
  using (public.can_access_lead(id) and public.has_permission('leads.write'))
  with check (public.has_permission('leads.write') and
    (public.member_has_full_scope() or assigned_to = auth.uid() or created_by = auth.uid()));
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete
  using (public.can_access_lead(id) and public.has_permission('leads.delete'));

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select
  using (public.can_access_client(id));
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert
  with check (public.has_permission('clients.write') and
    (public.member_has_full_scope() or created_by = auth.uid() or
      (lead_id is not null and public.is_assigned_lead(lead_id))));
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update
  using (public.can_access_client(id) and public.has_permission('clients.write'))
  with check (public.has_permission('clients.write') and
    (public.member_has_full_scope() or created_by = auth.uid() or
      (lead_id is not null and public.is_assigned_lead(lead_id))));
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete
  using (public.can_access_client(id) and public.has_permission('clients.delete'));

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select
  using (public.can_access_project(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert
  with check (public.has_permission('projects.write') and
    (public.member_has_full_scope() or created_by = auth.uid() or
      (client_id is not null and public.is_assigned_client(client_id))));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update
  using (public.can_access_project(id) and public.has_permission('projects.write'))
  with check (public.has_permission('projects.write') and
    (public.member_has_full_scope() or created_by = auth.uid() or
      (client_id is not null and public.is_assigned_client(client_id))));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete
  using (public.can_access_project(id) and public.has_permission('projects.delete'));

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select
  using (public.can_access_task(id));
drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks for insert
  with check (public.has_permission('tasks.write') and
    (public.member_has_full_scope() or assignee_id = auth.uid() or created_by = auth.uid() or
      (project_id is not null and public.is_assigned_project(project_id)) or
      (lead_id is not null and public.is_assigned_lead(lead_id))));
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks for update
  using (public.can_access_task(id) and public.has_permission('tasks.write'))
  with check (public.has_permission('tasks.write') and
    (public.member_has_full_scope() or assignee_id = auth.uid() or created_by = auth.uid() or
      (project_id is not null and public.is_assigned_project(project_id)) or
      (lead_id is not null and public.is_assigned_lead(lead_id))));
drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks for delete
  using (public.can_access_task(id) and public.has_permission('tasks.delete'));

drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals for select
  using (public.can_access_proposal(id));
drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert
  with check (public.has_permission('proposals.write') and
    (public.member_has_full_scope() or created_by = auth.uid() or
      (lead_id is not null and public.is_assigned_lead(lead_id)) or
      (project_id is not null and public.is_assigned_project(project_id))));
drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals for update
  using (public.can_access_proposal(id) and public.has_permission('proposals.write'))
  with check (public.has_permission('proposals.write') and
    (public.member_has_full_scope() or created_by = auth.uid() or
      (lead_id is not null and public.is_assigned_lead(lead_id)) or
      (project_id is not null and public.is_assigned_project(project_id))));
drop policy if exists proposals_delete on public.proposals;
create policy proposals_delete on public.proposals for delete
  using (public.can_access_proposal(id) and public.has_permission('proposals.delete'));

-- ---- 4. Related data inherits the access of its parent record ----
drop policy if exists lead_interactions_select on public.lead_interactions;
create policy lead_interactions_select on public.lead_interactions for select
  using (public.can_access_related(lead_id, client_id, project_id, null));
drop policy if exists lead_discovery_questions_select on public.lead_discovery_questions;
create policy lead_discovery_questions_select on public.lead_discovery_questions for select
  using (lead_id is null and public.has_permission('leads.read') or
    lead_id is not null and public.can_access_lead(lead_id));
drop policy if exists lead_campaigns_select on public.lead_campaigns;
create policy lead_campaigns_select on public.lead_campaigns for select
  using (public.has_permission('leads.read'));
drop policy if exists lead_campaign_sends_select on public.lead_campaign_sends;
create policy lead_campaign_sends_select on public.lead_campaign_sends for select
  using (public.has_permission('leads.read') and
    (lead_id is null or public.can_access_lead(lead_id)));

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select using (
  case when expense_id is not null then public.has_permission('finance.read')
       else public.can_access_related(lead_id, client_id, project_id, proposal_id) end
);
drop policy if exists generated_documents_select on public.generated_documents;
create policy generated_documents_select on public.generated_documents for select
  using (public.can_access_related(null, client_id, project_id, null));
drop policy if exists client_fiscal_verifications_select on public.client_fiscal_verifications;
create policy client_fiscal_verifications_select on public.client_fiscal_verifications for select
  using (public.can_access_client(client_id));
drop policy if exists reminders_select on public.reminders;
create policy reminders_select on public.reminders for select using (
  public.member_has_full_scope() or created_by = auth.uid() or
  public.can_access_related(lead_id, client_id, project_id, null)
);

drop policy if exists proposal_items_select on public.proposal_items;
create policy proposal_items_select on public.proposal_items for select
  using (public.has_permission('proposals.prices') and public.can_access_proposal(proposal_id));
drop policy if exists proposal_items_insert on public.proposal_items;
create policy proposal_items_insert on public.proposal_items for insert
  with check (public.has_permission('proposals.write') and public.has_permission('proposals.prices')
    and public.can_access_proposal(proposal_id));
drop policy if exists proposal_items_update on public.proposal_items;
create policy proposal_items_update on public.proposal_items for update
  using (public.has_permission('proposals.write') and public.has_permission('proposals.prices')
    and public.can_access_proposal(proposal_id))
  with check (public.has_permission('proposals.write') and public.has_permission('proposals.prices')
    and public.can_access_proposal(proposal_id));
drop policy if exists proposal_items_delete on public.proposal_items;
create policy proposal_items_delete on public.proposal_items for delete
  using (public.has_permission('proposals.delete') and public.can_access_proposal(proposal_id));
drop policy if exists proposal_specs_select on public.proposal_specs;
create policy proposal_specs_select on public.proposal_specs for select
  using (public.can_access_related(null, client_id, project_id, proposal_id));
drop policy if exists proposal_team_members_select on public.proposal_team_members;
create policy proposal_team_members_select on public.proposal_team_members for select
  using (public.can_access_proposal(proposal_id));
drop policy if exists proposal_messages_team_select on public.proposal_messages;
create policy proposal_messages_team_select on public.proposal_messages for select
  using (public.can_access_proposal(proposal_id));
drop policy if exists proposal_acceptances_team_select on public.proposal_acceptances;
create policy proposal_acceptances_team_select on public.proposal_acceptances for select
  using (public.can_access_proposal(proposal_id));
drop policy if exists proposal_view_events_select on public.proposal_view_events;
create policy proposal_view_events_select on public.proposal_view_events for select
  using (public.can_access_proposal(proposal_id));

drop policy if exists project_checklist_items_select on public.project_checklist_items;
create policy project_checklist_items_select on public.project_checklist_items for select
  using (public.can_access_project(project_id));
drop policy if exists project_requests_select on public.project_requests;
create policy project_requests_select on public.project_requests for select
  using (public.can_access_project(project_id));
drop policy if exists work_logs_select on public.work_logs;
create policy work_logs_select on public.work_logs for select
  using (public.can_access_project(project_id));
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments for select
  using (public.can_access_task(task_id));
drop policy if exists task_members_select on public.task_members;
create policy task_members_select on public.task_members for select
  using (public.can_access_task(task_id));
drop policy if exists task_tag_assignments_select on public.task_tag_assignments;
create policy task_tag_assignments_select on public.task_tag_assignments for select
  using (public.can_access_task(task_id));

drop policy if exists delivery_acceptances_team_select on public.delivery_acceptances;
create policy delivery_acceptances_team_select on public.delivery_acceptances for select
  using (public.can_access_related(null, client_id, project_id, proposal_id));
drop policy if exists delivery_acceptance_events_team_select on public.delivery_acceptance_events;
create policy delivery_acceptance_events_team_select on public.delivery_acceptance_events for select
  using (exists (
    select 1 from public.delivery_acceptances da
    where da.id = delivery_acceptance_events.delivery_acceptance_id
      and public.can_access_related(null, da.client_id, da.project_id, da.proposal_id)
  ));

-- ---- 5. Finance, marketing, and vault reads are module-gated ----
drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices for select
  using (public.has_permission('finance.read'));
drop policy if exists invoice_items_select on public.invoice_items;
create policy invoice_items_select on public.invoice_items for select
  using (public.has_permission('finance.read'));
drop policy if exists invoice_payments_select on public.invoice_payments;
create policy invoice_payments_select on public.invoice_payments for select
  using (public.has_permission('finance.read'));
drop policy if exists invoice_deliveries_select on public.invoice_deliveries;
create policy invoice_deliveries_select on public.invoice_deliveries for select
  using (public.has_permission('finance.read'));
drop policy if exists invoice_automations_select on public.invoice_automations;
create policy invoice_automations_select on public.invoice_automations for select
  using (public.has_permission('finance.read'));
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select
  using (public.has_permission('finance.read'));
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions for select
  using (public.has_permission('finance.read'));
drop policy if exists subscription_cpi_updates_select on public.subscription_cpi_updates;
create policy subscription_cpi_updates_select on public.subscription_cpi_updates for select
  using (public.has_permission('finance.read'));
drop policy if exists verifactu_ledger_select on public.verifactu_ledger;
create policy verifactu_ledger_select on public.verifactu_ledger for select
  using (public.has_permission('finance.read'));
drop policy if exists verifactu_outbox_select on public.verifactu_outbox;
create policy verifactu_outbox_select on public.verifactu_outbox for select
  using (public.has_permission('finance.read'));
drop policy if exists verifactu_diagnostic_runs_select on public.verifactu_diagnostic_runs;
create policy verifactu_diagnostic_runs_select on public.verifactu_diagnostic_runs for select
  using (public.has_permission('finance.read'));
drop policy if exists quarterly_advisor_deliveries_select on public.quarterly_advisor_deliveries;
create policy quarterly_advisor_deliveries_select on public.quarterly_advisor_deliveries for select
  using (public.has_permission('finance.read'));

drop policy if exists marketing_ad_sets_select on public.marketing_ad_sets;
create policy marketing_ad_sets_select on public.marketing_ad_sets for select
  using (public.has_permission('marketing.read'));
drop policy if exists marketing_ads_select on public.marketing_ads;
create policy marketing_ads_select on public.marketing_ads for select
  using (public.has_permission('marketing.read'));
drop policy if exists marketing_campaigns_select on public.marketing_campaigns;
create policy marketing_campaigns_select on public.marketing_campaigns for select
  using (public.has_permission('marketing.read'));
drop policy if exists marketing_insights_select on public.marketing_insights;
create policy marketing_insights_select on public.marketing_insights for select
  using (public.has_permission('marketing.read'));
drop policy if exists newsletter_issues_select on public.newsletter_issues;
create policy newsletter_issues_select on public.newsletter_issues for select
  using (public.has_permission('marketing.read'));
drop policy if exists web_projects_select on public.web_projects;
create policy web_projects_select on public.web_projects for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_posts_select on public.social_posts;
create policy social_posts_select on public.social_posts for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_comments_select on public.social_comments;
create policy social_comments_select on public.social_comments for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_post_targets_select on public.social_post_targets;
create policy social_post_targets_select on public.social_post_targets for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_post_insights_select on public.social_post_insights;
create policy social_post_insights_select on public.social_post_insights for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_automation_rules_select on public.social_automation_rules;
create policy social_automation_rules_select on public.social_automation_rules for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_automation_runs_select on public.social_automation_runs;
create policy social_automation_runs_select on public.social_automation_runs for select
  using (public.has_permission('marketing.read'));
drop policy if exists social_automation_events_select on public.social_automation_events;
create policy social_automation_events_select on public.social_automation_events for select
  using (public.has_permission('marketing.read'));
drop policy if exists google_business_profile_metrics_select on public.google_business_profile_metrics;
create policy google_business_profile_metrics_select on public.google_business_profile_metrics for select
  using (public.has_permission('marketing.read'));
drop policy if exists google_business_reviews_select on public.google_business_reviews;
create policy google_business_reviews_select on public.google_business_reviews for select
  using (public.has_permission('marketing.read'));
drop policy if exists vault_items_select on public.vault_items;
create policy vault_items_select on public.vault_items for select
  using (public.has_permission('vault.read'));

-- SECURITY DEFINER procedures still need parent checks: direct table RLS does not
-- protect a definer function from a caller who guesses another record id.
drop policy if exists proposal_team_members_insert on public.proposal_team_members;
create policy proposal_team_members_insert on public.proposal_team_members for insert
  with check (public.has_permission('proposals.write') and public.can_access_proposal(proposal_id));
drop policy if exists proposal_team_members_update on public.proposal_team_members;
create policy proposal_team_members_update on public.proposal_team_members for update
  using (public.has_permission('proposals.write') and public.can_access_proposal(proposal_id))
  with check (public.has_permission('proposals.write') and public.can_access_proposal(proposal_id));
drop policy if exists proposal_team_members_delete on public.proposal_team_members;
create policy proposal_team_members_delete on public.proposal_team_members for delete
  using (public.has_permission('proposals.write') and public.can_access_proposal(proposal_id));

drop policy if exists task_members_insert on public.task_members;
create policy task_members_insert on public.task_members for insert
  with check (public.has_permission('tasks.write') and public.can_access_task(task_id));
drop policy if exists task_members_delete on public.task_members;
create policy task_members_delete on public.task_members for delete
  using (public.has_permission('tasks.write') and public.can_access_task(task_id));

-- ---- 6. Replace legacy write-role lists with permission packages ----
do $$
declare
  p record;
  module_permission text;
  new_qual text;
  new_check text;
  statement text;
  legacy_roles constant text := 'current_member_role() = ANY (ARRAY[''owner''::member_role, ''admin''::member_role, ''member''::member_role])';
begin
  for p in
    select * from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') like '%''member''::member_role%'
        or coalesce(with_check, '') like '%''member''::member_role%')
  loop
    module_permission := case
      when p.schemaname = 'storage' then
        case when coalesce(p.qual, p.with_check, '') like '%social-media%' then 'marketing.write'
             when coalesce(p.qual, p.with_check, '') like '%brand-assets%' then 'workspace.write'
             else 'workspace.write' end
      when p.tablename in ('leads', 'lead_interactions', 'lead_discovery_questions', 'lead_campaigns', 'lead_campaign_sends') then 'leads.write'
      when p.tablename = 'clients' then 'clients.write'
      when p.tablename in ('projects', 'project_checklist_items', 'project_requests', 'delivery_acceptances', 'delivery_acceptance_events') then 'projects.write'
      when p.tablename in ('tasks', 'task_comments', 'task_tag_assignments', 'task_tags', 'work_logs') then 'tasks.write'
      when p.tablename in ('proposals', 'proposal_items', 'proposal_specs', 'proposal_team_members') then 'proposals.write'
      when p.tablename in ('invoices', 'invoice_items', 'invoice_payments', 'invoice_deliveries', 'invoice_automations', 'expenses', 'subscriptions', 'subscription_cpi_updates') then 'finance.write'
      when p.tablename in ('newsletter_issues', 'google_business_profile_metrics', 'google_business_reviews', 'social_automation_rules', 'social_comments', 'social_post_insights', 'social_post_targets', 'social_posts', 'web_projects') then 'marketing.write'
      when p.tablename = 'vault_items' then 'vault.write'
      when p.tablename in ('email_templates') then 'settings.manage'
      when p.tablename in ('activity_log', 'attachments', 'events', 'event_attendees', 'generated_documents', 'internal_document_events', 'internal_documents', 'notifications', 'reminders') then 'workspace.write'
      else null
    end;
    if module_permission is null then continue; end if;

    new_qual := case when p.qual is null then null
      else replace(p.qual, legacy_roles, format('public.has_permission(''%s'')', module_permission)) end;
    new_check := case when p.with_check is null then null
      else replace(p.with_check, legacy_roles, format('public.has_permission(''%s'')', module_permission)) end;
    statement := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then statement := statement || format(' using (%s)', new_qual); end if;
    if p.with_check is not null then statement := statement || format(' with check (%s)', new_check); end if;
    execute statement;
  end loop;
end
$$;

-- Proposal totals are stored on the parent row, so row-level policies alone
-- cannot hide those columns from delivery roles. Remove table-wide SELECT for
-- authenticated users and grant non-price fields individually. Prices are
-- exposed through the permission-checked view below; service_role/anon grants
-- remain unchanged for existing portal and MCP flows.
do $$
declare
  safe_columns text;
begin
  revoke select on public.proposals from authenticated;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into safe_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'proposals'
    and column_name not in (
      'subtotal', 'tax_amount', 'total', 'maintenance_options', 'payment_terms'
    );
  execute format('grant select (%s) on public.proposals to authenticated', safe_columns);
end
$$;

create or replace view public.proposal_prices
with (security_barrier = true)
as
  select p.id as proposal_id, p.subtotal, p.tax_amount, p.total,
    p.maintenance_options, p.payment_terms
  from public.proposals p
  where public.has_permission('proposals.prices')
    and public.can_access_proposal(p.id);

revoke all on public.proposal_prices from public, anon;
grant select on public.proposal_prices to authenticated;

-- Authenticated client-portal users are not team members and therefore cannot
-- use the internal price view. Expose only the totals of proposals assigned to
-- their enabled portal account; draft and deleted proposals remain hidden.
create or replace view public.client_portal_proposal_prices
with (security_barrier = true)
as
  select p.id as proposal_id, p.subtotal, p.tax_amount, p.total,
    p.maintenance_options, p.payment_terms
  from public.proposals p
  where p.deleted_at is null
    and p.status <> 'draft'
    and exists (
      select 1 from public.client_portal_access access
      where access.client_id = p.client_id
        and access.user_id = auth.uid()
        and access.enabled = true
    );

revoke all on public.client_portal_proposal_prices from public, anon;
grant select on public.client_portal_proposal_prices to authenticated;

-- New clients/projects remain visible to their creator when scope is assigned.
alter table public.clients alter column created_by set default auth.uid();
alter table public.projects alter column created_by set default auth.uid();

-- Function-level gates for privileged RPCs; admin-only invoice issuance and
-- cancellation checks are intentionally left unchanged.
do $$
declare
  f record;
  definition text;
begin
  for f in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as body
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'convert_lead_to_client', 'create_hourly_invoice',
      'replace_proposal_items', 'update_proposal_items_versioned'
    )
  loop
    definition := case f.proname
      when 'convert_lead_to_client' then replace(
        f.body,
        $old$if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then$old$,
        $new$if not (public.has_permission('leads.write') and public.has_permission('clients.write')) then$new$
      )
      when 'create_hourly_invoice' then replace(
        f.body,
        $old$if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then$old$,
        $new$if not public.has_permission('finance.write') then$new$
      )
      else replace(
        f.body,
        $old$if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then$old$,
        $new$if not (public.has_permission('proposals.write') and public.has_permission('proposals.prices')) then$new$
      )
    end;
    if definition = f.body then
      raise exception 'Expected role check not found in function %', f.proname;
    end if;
    execute definition;
  end loop;
end
$$;

create or replace function public.member_has_full_scope()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead_id and (l.assigned_to = auth.uid() or l.created_by = auth.uid())
  )
$$;

create or replace function public.is_assigned_project(p_project_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
      select 1 from public.projects pr
      where pr.id = p_project_id and pr.created_by = auth.uid()
    )
    or exists (
      select 1 from public.tasks t
      where t.project_id = p_project_id and t.deleted_at is null
        and (t.assignee_id = auth.uid() or t.created_by = auth.uid()
          or exists (
            select 1 from public.task_members m where m.task_id = t.id and m.member_id = auth.uid()
          ))
    )
    or exists (
      select 1 from public.proposals p
      join public.proposal_team_members m on m.proposal_id = p.id
      where p.project_id = p_project_id and p.deleted_at is null and m.member_id = auth.uid()
    )
    or exists (
      select 1 from public.proposals p
      where p.project_id = p_project_id and p.deleted_at is null and p.created_by = auth.uid()
    )
$$;


create or replace function public.is_assigned_proposal(p_proposal_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
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
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1 from public.clients c
      where c.id = p_client_id and (c.created_by = auth.uid()
        or (c.lead_id is not null and public.is_assigned_lead(c.lead_id)))
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
set search_path = public, pg_temp
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
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('leads.read') and (public.member_has_full_scope() or public.is_assigned_lead(p_lead_id)) $$;

create or replace function public.can_access_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('clients.read') and (public.member_has_full_scope() or public.is_assigned_client(p_client_id)) $$;

create or replace function public.can_access_proposal(p_proposal_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('proposals.read') and (public.member_has_full_scope() or public.is_assigned_proposal(p_proposal_id)) $$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('projects.read') and (public.member_has_full_scope() or public.is_assigned_project(p_project_id)) $$;

create or replace function public.can_access_task(p_task_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.has_permission('tasks.read') and (public.member_has_full_scope() or public.is_assigned_task(p_task_id)) $$;

-- Rows linked to multiple records require access to every linked record.
create or replace function public.can_access_related(
  p_lead_id uuid, p_client_id uuid, p_project_id uuid, p_proposal_id uuid
)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_team_member()
    and (p_lead_id is not null or p_client_id is not null or p_project_id is not null
      or p_proposal_id is not null or public.member_has_full_scope())
    and (p_lead_id is null or public.can_access_lead(p_lead_id))
    and (p_client_id is null or public.can_access_client(p_client_id))
    and (p_project_id is null or public.can_access_project(p_project_id))
    and (p_proposal_id is null or public.can_access_proposal(p_proposal_id))
$$;
