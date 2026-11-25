-- The CRM owner is the lead. Keep client_id as a separate fiscal/portal identity.
set local lock_timeout = '5s';
lock table public.clients, public.projects, public.proposals, public.invoices,
  public.subscriptions, public.tasks, public.attachments, public.reminders
  in share row exclusive mode;

alter table public.clients alter column lead_id set not null;
alter table public.projects alter column client_id drop not null;
alter table public.proposals drop constraint proposals_lead_or_client_chk;
-- Historical proposals may point to archived leads, clients or projects. Only
-- the existing project-link validator is suspended during metadata backfill.
alter table public.proposals disable trigger trg_enforce_proposal_project_commercial_relationship;

do $$
declare relation text;
begin
  foreach relation in array array['projects', 'proposals', 'invoices', 'subscriptions', 'tasks', 'attachments', 'reminders'] loop
    if relation in ('projects', 'invoices', 'subscriptions') then
      execute format('alter table public.%I add column lead_id uuid references public.leads(id) on delete restrict', relation);
    end if;
    execute format('update public.%I d set lead_id = c.lead_id from public.clients c where d.client_id = c.id and d.lead_id is null', relation);
    if relation in ('projects', 'proposals', 'invoices', 'subscriptions') then
      execute format('alter table public.%I alter column lead_id set not null', relation);
    end if;
    if relation in ('projects', 'invoices', 'subscriptions') then
      execute format('create index %I on public.%I (lead_id)', relation || '_lead_id_idx', relation);
    end if;
  end loop;
end $$;

create function public.assign_commercial_lead() returns trigger
language plpgsql security definer set search_path = '' as $$
declare billing_lead uuid;
begin
  if new.client_id is not null then
    select lead_id into billing_lead from public.clients where id = new.client_id;
    if not found then raise foreign_key_violation using message = 'Billing record not found'; end if;
    if new.lead_id is null then
      new.lead_id := billing_lead;
    elsif tg_op = 'UPDATE' and tg_table_name in ('projects', 'invoices', 'subscriptions')
      and new.client_id is distinct from old.client_id and new.lead_id is not distinct from old.lead_id then
      -- Older versions only pass client_id when changing a draft recipient.
      new.lead_id := billing_lead;
    elsif new.lead_id is distinct from billing_lead then
      raise check_violation using message = 'The billing record belongs to another lead';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if tg_table_name = 'invoices' then
      if old.status <> 'draft' and (new.lead_id is distinct from old.lead_id or new.client_id is distinct from old.client_id) then
        raise check_violation using message = 'No se puede cambiar el destinatario de una factura emitida';
      end if;
    elsif tg_table_name = 'projects' and new.lead_id is distinct from old.lead_id then
      if exists (select 1 from public.proposals where project_id = old.id)
        or exists (select 1 from public.invoices where project_id = old.id)
        or exists (select 1 from public.subscriptions where project_id = old.id) then
        raise check_violation using message = 'No se puede cambiar el lead de un proyecto con documentos vinculados';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.assign_commercial_lead() from public, anon, authenticated;

create function public.protect_billing_lead() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise check_violation using message = 'No se puede reasignar una ficha de facturación a otro lead';
end $$;
revoke all on function public.protect_billing_lead() from public, anon, authenticated;
create trigger protect_billing_lead before update of lead_id on public.clients
  for each row when (old.lead_id is distinct from new.lead_id) execute function public.protect_billing_lead();

do $$
declare relation text;
begin
  foreach relation in array array['projects', 'proposals', 'invoices', 'subscriptions', 'tasks', 'attachments', 'reminders'] loop
    execute format('create trigger assign_commercial_lead before insert or update of client_id, lead_id on public.%I for each row execute function public.assign_commercial_lead()', relation);
  end loop;
end $$;

create or replace function public.mcp_assert_commercial_relationship(
  p_client_id uuid, p_lead_id uuid, p_project_id uuid default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare billing_lead uuid; recipient uuid; project_client uuid; project_lead uuid;
begin
  if p_client_id is not null then
    select lead_id into billing_lead from public.clients where id = p_client_id and deleted_at is null;
    if not found then raise exception 'Client not found'; end if;
    if p_lead_id is not null and p_lead_id is distinct from billing_lead then
      raise exception 'The billing record belongs to another lead';
    end if;
  end if;
  recipient := coalesce(p_lead_id, billing_lead);
  if not exists (select 1 from public.leads where id = recipient and deleted_at is null) then
    raise exception 'Lead not found';
  end if;
  if p_project_id is null then return; end if;

  select client_id, lead_id into project_client, project_lead from public.projects
    where id = p_project_id and deleted_at is null for share;
  if not found then raise exception 'Project not found'; end if;
  if project_lead is distinct from recipient then raise exception 'Project belongs to another lead'; end if;
  if project_client is not null and p_client_id is not null and project_client is distinct from p_client_id then
    raise exception 'Project belongs to another billing record';
  end if;
end $$;

create or replace function public.enforce_proposal_project_commercial_relationship()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is not null and (tg_op = 'INSERT' or
    (new.project_id, new.lead_id, new.client_id) is distinct from (old.project_id, old.lead_id, old.client_id)) then
    perform public.mcp_assert_commercial_relationship(new.client_id, new.lead_id, new.project_id);
  end if;
  return new;
end $$;
alter table public.proposals enable trigger trg_enforce_proposal_project_commercial_relationship;

notify pgrst, 'reload schema';