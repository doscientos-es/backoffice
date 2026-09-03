-- Allowlisted proposal and project mutations for the internal MCP.
-- All writes stay behind token-checked SECURITY DEFINER functions; no MCP write
-- RLS policy is introduced. Associations are validated as one commercial graph.

alter table public.proposals add column if not exists mcp_idempotency_key uuid;
alter table public.projects add column if not exists mcp_idempotency_key uuid;
create unique index if not exists proposals_mcp_idempotency_key_idx
  on public.proposals(mcp_idempotency_key) where mcp_idempotency_key is not null;
create unique index if not exists projects_mcp_idempotency_key_idx
  on public.projects(mcp_idempotency_key) where mcp_idempotency_key is not null;

create or replace function public.mcp_assert_commercial_relationship(
  p_client_id uuid,
  p_lead_id uuid,
  p_project_id uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare v_project_client_id uuid; v_project_lead_id uuid;
begin
  if (p_client_id is null) = (p_lead_id is null) then
    raise exception 'Provide exactly one commercial target: client or lead';
  end if;
  if p_client_id is not null and not exists (
    select 1 from public.clients where id = p_client_id and deleted_at is null
  ) then raise exception 'Client not found'; end if;
  if p_lead_id is not null and not exists (
    select 1 from public.leads where id = p_lead_id and deleted_at is null
  ) then raise exception 'Lead not found'; end if;
  if p_project_id is null then return; end if;

  select project.client_id, client.lead_id into v_project_client_id, v_project_lead_id
  from public.projects project join public.clients client on client.id = project.client_id
  where project.id = p_project_id and project.deleted_at is null and client.deleted_at is null;
  if not found then raise exception 'Project not found'; end if;
  if p_client_id is not null and v_project_client_id <> p_client_id then
    raise exception 'Project belongs to another client';
  end if;
  if p_lead_id is not null and v_project_lead_id is distinct from p_lead_id then
    raise exception 'Project client is not linked to this lead';
  end if;
end;
$$;

create or replace function public.mcp_assert_project_client_relationship(
  p_client_id uuid, p_lead_id uuid, p_check_lead boolean
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_lead_id uuid;
begin
  select lead_id into v_lead_id from public.clients
  where id = p_client_id and deleted_at is null;
  if not found then raise exception 'Client not found'; end if;
  if p_check_lead and v_lead_id is distinct from p_lead_id then
    raise exception 'Client is not linked to the supplied lead';
  end if;
  if p_check_lead and p_lead_id is not null and not exists (
    select 1 from public.leads where id = p_lead_id and deleted_at is null
  ) then raise exception 'Lead not found'; end if;
  return v_lead_id;
end;
$$;

create or replace function public.mcp_validate_proposal_items(p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Proposal requires 1 to 100 line items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(length(btrim(item.value ->> 'description')), 0) not between 1 and 500
      or jsonb_typeof(item.value -> 'quantity') <> 'number'
      or jsonb_typeof(item.value -> 'unitPrice') <> 'number'
      or coalesce(jsonb_typeof(item.value -> 'vatRate'), 'number') <> 'number'
      or (item.value ->> 'quantity')::numeric <= 0
      or (item.value ->> 'unitPrice')::numeric < 0
      or coalesce((item.value ->> 'vatRate')::numeric, 21) not between 0 and 100
      or coalesce(item.value ->> 'billingCycle', 'none') not in ('none', 'monthly', 'quarterly', 'yearly')
  ) then raise exception 'Proposal line items are invalid'; end if;
end;
$$;

create or replace function public.mcp_validate_proposal_patch(p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_patch) <> 'object' or p_patch - array[
    'title', 'valid_until', 'notes', 'context_markdown', 'problems', 'solutions', 'terms',
    'scope_modules', 'deliverables', 'acceptance_criteria', 'payment_schedule', 'payment_plan',
    'payment_terms', 'change_management_terms', 'maintenance_options',
    'maintenance_selected_plan_id', 'project_id'
  ] <> '{}'::jsonb then raise exception 'Invalid proposal fields'; end if;
  if p_patch ? 'title' and coalesce(length(btrim(p_patch ->> 'title')), 0) not between 1 and 200 then
    raise exception 'Proposal title must contain 1 to 200 characters';
  end if;
  if coalesce(length(p_patch ->> 'notes'), 0) > 4000
    or coalesce(length(p_patch ->> 'context_markdown'), 0) > 20000
    or coalesce(length(p_patch ->> 'terms'), 0) > 20000
    or coalesce(length(p_patch ->> 'deliverables'), 0) > 20000
    or coalesce(length(p_patch ->> 'acceptance_criteria'), 0) > 20000
    or coalesce(length(p_patch ->> 'payment_terms'), 0) > 8000
    or coalesce(length(p_patch ->> 'change_management_terms'), 0) > 8000 then
    raise exception 'Proposal text field is too long';
  end if;
  if p_patch ? 'payment_schedule' and p_patch ->> 'payment_schedule' not in (
    'upfront', 'half_half', '30_40_30', 'per_module_upfront', 'custom'
  ) then raise exception 'Invalid payment schedule'; end if;
  if p_patch ? 'project_id' and p_patch -> 'project_id' <> 'null'::jsonb
    and jsonb_typeof(p_patch -> 'project_id') <> 'string' then raise exception 'Invalid project ID'; end if;
end;
$$;

-- Applies the same association rule to UI actions, portal conversion and MCP.
-- Existing rows remain untouched; only future inserts or relationship changes are checked.
create or replace function public.enforce_proposal_project_commercial_relationship()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.project_id is not null then
    perform public.mcp_assert_commercial_relationship(new.client_id, new.lead_id, new.project_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_proposal_project_commercial_relationship on public.proposals;
create trigger trg_enforce_proposal_project_commercial_relationship
  before insert or update of client_id, lead_id, project_id on public.proposals
  for each row execute function public.enforce_proposal_project_commercial_relationship();

create or replace function public.mcp_create_proposal(
  p_lead_id uuid, p_client_id uuid, p_patch jsonb, p_items jsonb, p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_proposal public.proposals%rowtype; v_project_id uuid;
declare v_subtotal numeric(12,2); v_tax_amount numeric(12,2); v_total numeric(12,2);
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  perform public.mcp_validate_proposal_patch(p_patch);
  perform public.mcp_validate_proposal_items(p_items);
  if not (p_patch ? 'title') then raise exception 'Proposal title is required'; end if;
  v_project_id := nullif(p_patch ->> 'project_id', '')::uuid;
  perform public.mcp_assert_commercial_relationship(p_client_id, p_lead_id, v_project_id);
  if p_idempotency_key is not null then
    select * into v_proposal from public.proposals where mcp_idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('id', v_proposal.id, 'version', v_proposal.version, 'idempotentReplay', true); end if;
  end if;
  select coalesce(round(sum((value ->> 'quantity')::numeric * (value ->> 'unitPrice')::numeric)
    filter (where coalesce(value ->> 'billingCycle', 'none') = 'none'), 2), 0),
    coalesce(round(sum((value ->> 'quantity')::numeric * (value ->> 'unitPrice')::numeric * coalesce((value ->> 'vatRate')::numeric, 21) / 100)
    filter (where coalesce(value ->> 'billingCycle', 'none') = 'none'), 2), 0)
  into v_subtotal, v_tax_amount from jsonb_array_elements(p_items);
  v_total := round(v_subtotal + v_tax_amount, 2);
  insert into public.proposals (
    lead_id, client_id, project_id, number, title, status, currency, subtotal, tax_amount, total,
    valid_until, notes, context_markdown, problems, solutions, terms, scope_modules, deliverables,
    acceptance_criteria, payment_schedule, payment_plan, payment_terms, change_management_terms,
    maintenance_options, maintenance_selected_plan_id, mcp_idempotency_key
  ) values (
    p_lead_id, p_client_id, v_project_id, null, btrim(p_patch ->> 'title'), 'draft', 'EUR',
    v_subtotal, v_tax_amount, v_total, nullif(p_patch ->> 'valid_until', '')::date,
    nullif(btrim(p_patch ->> 'notes'), ''), nullif(btrim(p_patch ->> 'context_markdown'), ''),
    nullif(p_patch -> 'problems', 'null'::jsonb), nullif(p_patch -> 'solutions', 'null'::jsonb),
    nullif(btrim(p_patch ->> 'terms'), ''), nullif(p_patch -> 'scope_modules', 'null'::jsonb),
    nullif(btrim(p_patch ->> 'deliverables'), ''), nullif(btrim(p_patch ->> 'acceptance_criteria'), ''),
    coalesce(nullif(p_patch ->> 'payment_schedule', ''), 'half_half'),
    coalesce(nullif(p_patch -> 'payment_plan', 'null'::jsonb), '[]'::jsonb),
    coalesce(nullif(btrim(p_patch ->> 'payment_terms'), ''), 'El 50 % del importe se abonará a la aceptación de la propuesta y el 50 % restante a la entrega.'),
    coalesce(nullif(btrim(p_patch ->> 'change_management_terms'), ''), 'Las solicitudes que excedan el alcance descrito se analizarán y, si procede, se presentarán como una ampliación de alcance y presupuesto antes de ejecutarse.'),
    nullif(p_patch -> 'maintenance_options', 'null'::jsonb), nullif(btrim(p_patch ->> 'maintenance_selected_plan_id'), ''), p_idempotency_key
  ) returning * into v_proposal;
  insert into public.proposal_items (proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle)
  select v_proposal.id, position - 1, btrim(value ->> 'description'), (value ->> 'quantity')::numeric,
    (value ->> 'unitPrice')::numeric, coalesce((value ->> 'vatRate')::numeric, 21),
    coalesce(value ->> 'billingCycle', 'none')::public.expense_recurrence
  from jsonb_array_elements(p_items) with ordinality item(value, position);
  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('proposal', v_proposal.id, 'mcp.created', jsonb_build_object('lead_id', p_lead_id, 'client_id', p_client_id, 'project_id', v_project_id));
  return jsonb_build_object('id', v_proposal.id, 'leadId', p_lead_id, 'clientId', p_client_id, 'projectId', v_project_id, 'version', v_proposal.version, 'total', v_total, 'idempotentReplay', false);
end;
$$;

create or replace function public.mcp_update_proposal(
  p_proposal_id uuid, p_expected_version bigint, p_patch jsonb, p_items jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_current public.proposals%rowtype; v_proposal public.proposals%rowtype; v_project_id uuid;
declare v_subtotal numeric(12,2); v_tax_amount numeric(12,2); v_total numeric(12,2);
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  perform public.mcp_validate_proposal_patch(p_patch);
  perform public.mcp_validate_proposal_items(p_items);
  if p_patch = '{}'::jsonb then raise exception 'At least one proposal field must be provided'; end if;
  select * into v_current from public.proposals where id = p_proposal_id and deleted_at is null for update;
  if not found then raise exception 'Proposal not found'; end if;
  if v_current.version <> p_expected_version then raise exception 'Proposal version conflict; read it again before updating'; end if;
  if v_current.status in ('accepted', 'rejected') then raise exception 'Answered proposals cannot be edited'; end if;
  v_project_id := case when p_patch ? 'project_id' then nullif(p_patch ->> 'project_id', '')::uuid else v_current.project_id end;
  perform public.mcp_assert_commercial_relationship(v_current.client_id, v_current.lead_id, v_project_id);
  select coalesce(round(sum((value ->> 'quantity')::numeric * (value ->> 'unitPrice')::numeric)
    filter (where coalesce(value ->> 'billingCycle', 'none') = 'none'), 2), 0),
    coalesce(round(sum((value ->> 'quantity')::numeric * (value ->> 'unitPrice')::numeric * coalesce((value ->> 'vatRate')::numeric, 21) / 100)
    filter (where coalesce(value ->> 'billingCycle', 'none') = 'none'), 2), 0)
  into v_subtotal, v_tax_amount from jsonb_array_elements(p_items);
  v_total := round(v_subtotal + v_tax_amount, 2);
  update public.proposals set
    project_id = v_project_id, title = case when p_patch ? 'title' then btrim(p_patch ->> 'title') else title end,
    valid_until = case when p_patch ? 'valid_until' then nullif(p_patch ->> 'valid_until', '')::date else valid_until end,
    notes = case when p_patch ? 'notes' then nullif(btrim(p_patch ->> 'notes'), '') else notes end,
    context_markdown = case when p_patch ? 'context_markdown' then nullif(btrim(p_patch ->> 'context_markdown'), '') else context_markdown end,
    problems = case when p_patch ? 'problems' then nullif(p_patch -> 'problems', 'null'::jsonb) else problems end,
    solutions = case when p_patch ? 'solutions' then nullif(p_patch -> 'solutions', 'null'::jsonb) else solutions end,
    terms = case when p_patch ? 'terms' then nullif(btrim(p_patch ->> 'terms'), '') else terms end,
    scope_modules = case when p_patch ? 'scope_modules' then nullif(p_patch -> 'scope_modules', 'null'::jsonb) else scope_modules end,
    deliverables = case when p_patch ? 'deliverables' then nullif(btrim(p_patch ->> 'deliverables'), '') else deliverables end,
    acceptance_criteria = case when p_patch ? 'acceptance_criteria' then nullif(btrim(p_patch ->> 'acceptance_criteria'), '') else acceptance_criteria end,
    payment_schedule = case when p_patch ? 'payment_schedule' then p_patch ->> 'payment_schedule' else payment_schedule end,
    payment_plan = case when p_patch ? 'payment_plan' then p_patch -> 'payment_plan' else payment_plan end,
    payment_terms = case when p_patch ? 'payment_terms' then nullif(btrim(p_patch ->> 'payment_terms'), '') else payment_terms end,
    change_management_terms = case when p_patch ? 'change_management_terms' then nullif(btrim(p_patch ->> 'change_management_terms'), '') else change_management_terms end,
    maintenance_options = case when p_patch ? 'maintenance_options' then nullif(p_patch -> 'maintenance_options', 'null'::jsonb) else maintenance_options end,
    maintenance_selected_plan_id = case when p_patch ? 'maintenance_selected_plan_id' then nullif(btrim(p_patch ->> 'maintenance_selected_plan_id'), '') else maintenance_selected_plan_id end,
    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total, updated_at = now()
  where id = p_proposal_id and version = p_expected_version returning * into v_proposal;
  if not found then raise exception 'Proposal version conflict; read it again before updating'; end if;
  delete from public.proposal_items where proposal_id = p_proposal_id;
  insert into public.proposal_items (proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle)
  select p_proposal_id, position - 1, btrim(value ->> 'description'), (value ->> 'quantity')::numeric,
    (value ->> 'unitPrice')::numeric, coalesce((value ->> 'vatRate')::numeric, 21), coalesce(value ->> 'billingCycle', 'none')::public.expense_recurrence
  from jsonb_array_elements(p_items) with ordinality item(value, position);
  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('proposal', v_proposal.id, 'mcp.updated', jsonb_build_object('version', v_proposal.version, 'project_id', v_project_id));
  return jsonb_build_object('id', v_proposal.id, 'projectId', v_project_id, 'version', v_proposal.version, 'total', v_total);
end;
$$;

create or replace function public.mcp_create_project(
  p_client_id uuid, p_lead_id uuid, p_patch jsonb, p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_project public.projects%rowtype; v_lead_id uuid; v_mode text; v_repo text;
declare v_owner text; v_repo_name text; v_paths text[];
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  if jsonb_typeof(p_patch) <> 'object' or p_patch - array['client_id', 'name', 'description', 'status', 'starts_at', 'ends_at', 'billing_type', 'hourly_rate', 'hourly_vat_rate', 'github_sync_mode', 'github_auto_sync', 'github_repo', 'github_installation_id', 'workspace_paths'] <> '{}'::jsonb then raise exception 'Invalid project fields'; end if;
  if coalesce(length(btrim(p_patch ->> 'name')), 0) not between 1 and 160 then raise exception 'Project name is required'; end if;
  if p_patch ? 'client_id' and (p_patch ->> 'client_id')::uuid <> p_client_id then raise exception 'Project client mismatch'; end if;
  v_lead_id := public.mcp_assert_project_client_relationship(p_client_id, p_lead_id, p_lead_id is not null);
  if p_idempotency_key is not null then
    select * into v_project from public.projects where mcp_idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('id', v_project.id, 'clientId', v_project.client_id, 'version', v_project.version, 'idempotentReplay', true); end if;
  end if;
  v_mode := coalesce(p_patch ->> 'github_sync_mode', 'none'); v_repo := nullif(p_patch ->> 'github_repo', '');
  if v_mode not in ('none', 'link_only', 'bidirectional') then raise exception 'Invalid GitHub sync mode'; end if;
  if v_mode <> 'none' and (v_repo is null or v_repo !~ '^https://github[.]com/[^/]+/[^/?#]+/?$') then raise exception 'A valid GitHub repository is required'; end if;
  if v_mode = 'bidirectional' and nullif(p_patch ->> 'github_installation_id', '') is null then raise exception 'Bidirectional sync requires githubInstallationId'; end if;
  if v_mode = 'none' then v_repo := null; v_owner := null; v_repo_name := null; else
    v_owner := substring(v_repo from '^https://github[.]com/([^/]+)/');
    v_repo_name := regexp_replace(substring(v_repo from '^https://github[.]com/[^/]+/([^/?#]+)'), '[.]git$', '');
  end if;
  select coalesce(array_agg(value), '{}'::text[]) into v_paths from jsonb_array_elements_text(coalesce(p_patch -> 'workspace_paths', '[]'::jsonb));
  if not public.are_safe_project_workspace_paths(v_paths) then raise exception 'Workspace paths must be safe and repository-relative'; end if;
  if nullif(p_patch ->> 'billing_type', 'fixed') = 'hourly' and coalesce((p_patch ->> 'hourly_rate')::numeric, 0) <= 0 then raise exception 'Hourly projects require hourlyRate'; end if;
  insert into public.projects (client_id, name, description, status, starts_at, ends_at, billing_type, hourly_rate, hourly_vat_rate, github_sync_mode, github_auto_sync, github_repo, github_repo_owner, github_repo_name, github_installation_id, workspace_paths, mcp_idempotency_key)
  values (p_client_id, btrim(p_patch ->> 'name'), nullif(btrim(p_patch ->> 'description'), ''), coalesce(p_patch ->> 'status', 'planning')::public.project_status, nullif(p_patch ->> 'starts_at', '')::date, nullif(p_patch ->> 'ends_at', '')::date, coalesce(p_patch ->> 'billing_type', 'fixed'), case when coalesce(p_patch ->> 'billing_type', 'fixed') = 'hourly' then (p_patch ->> 'hourly_rate')::numeric else null end, coalesce((p_patch ->> 'hourly_vat_rate')::numeric, 21), v_mode, case when v_mode = 'bidirectional' then coalesce((p_patch ->> 'github_auto_sync')::boolean, true) else true end, v_repo, v_owner, v_repo_name, case when v_mode = 'bidirectional' then (p_patch ->> 'github_installation_id')::bigint else null end, v_paths, p_idempotency_key) returning * into v_project;
  insert into public.activity_log(entity_type, entity_id, action, details) values ('project', v_project.id, 'mcp.created', jsonb_build_object('client_id', p_client_id, 'lead_id', v_lead_id));
  return jsonb_build_object('id', v_project.id, 'clientId', p_client_id, 'leadId', v_lead_id, 'version', v_project.version, 'idempotentReplay', false);
end;
$$;

-- Project updates deliberately keep their existing client unless client_id is patched.
-- The lead value is an optional consistency assertion, not a second project FK.
create or replace function public.mcp_update_project(
  p_project_id uuid, p_expected_version bigint, p_lead_id uuid, p_check_lead boolean, p_patch jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_current public.projects%rowtype; v_project public.projects%rowtype; v_client_id uuid; v_lead uuid;
declare v_mode text; v_repo text; v_owner text; v_repo_name text; v_paths text[]; v_billing text; v_rate numeric;
begin
  if not public.has_valid_mcp_access_token() then raise exception 'Invalid MCP access token' using errcode = '42501'; end if;
  if jsonb_typeof(p_patch) <> 'object' or p_patch - array['client_id', 'name', 'description', 'status', 'starts_at', 'ends_at', 'billing_type', 'hourly_rate', 'hourly_vat_rate', 'github_sync_mode', 'github_auto_sync', 'github_repo', 'github_installation_id', 'workspace_paths'] <> '{}'::jsonb then raise exception 'Invalid project fields'; end if;
  select * into v_current from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then raise exception 'Project not found'; end if;
  if v_current.version <> p_expected_version then raise exception 'Project version conflict; read it again before updating'; end if;
  v_client_id := coalesce(nullif(p_patch ->> 'client_id', '')::uuid, v_current.client_id);
  v_lead := public.mcp_assert_project_client_relationship(v_client_id, p_lead_id, p_check_lead);
  if p_patch = '{}'::jsonb then return jsonb_build_object('id', v_current.id, 'clientId', v_client_id, 'leadId', v_lead, 'version', v_current.version); end if;
  v_mode := coalesce(p_patch ->> 'github_sync_mode', v_current.github_sync_mode); v_repo := coalesce(nullif(p_patch ->> 'github_repo', ''), v_current.github_repo);
  if v_mode not in ('none', 'link_only', 'bidirectional') then raise exception 'Invalid GitHub sync mode'; end if;
  if v_mode <> 'none' and (v_repo is null or v_repo !~ '^https://github[.]com/[^/]+/[^/?#]+/?$') then raise exception 'A valid GitHub repository is required'; end if;
  if v_mode = 'bidirectional' and coalesce(nullif(p_patch ->> 'github_installation_id', '')::bigint, v_current.github_installation_id) is null then raise exception 'Bidirectional sync requires githubInstallationId'; end if;
  if v_mode = 'none' then v_repo := null; v_owner := null; v_repo_name := null; else v_owner := substring(v_repo from '^https://github[.]com/([^/]+)/'); v_repo_name := regexp_replace(substring(v_repo from '^https://github[.]com/[^/]+/([^/?#]+)'), '[.]git$', ''); end if;
  if p_patch ? 'workspace_paths' then select coalesce(array_agg(value), '{}'::text[]) into v_paths from jsonb_array_elements_text(p_patch -> 'workspace_paths'); else v_paths := v_current.workspace_paths; end if;
  if not public.are_safe_project_workspace_paths(v_paths) then raise exception 'Workspace paths must be safe and repository-relative'; end if;
  v_billing := coalesce(p_patch ->> 'billing_type', v_current.billing_type); v_rate := case when p_patch ? 'hourly_rate' then nullif(p_patch ->> 'hourly_rate', '')::numeric else v_current.hourly_rate end;
  if v_billing not in ('fixed', 'hourly') or (v_billing = 'hourly' and coalesce(v_rate, 0) <= 0) then raise exception 'Hourly projects require hourlyRate'; end if;
  update public.projects set client_id = v_client_id, name = case when p_patch ? 'name' then btrim(p_patch ->> 'name') else name end, description = case when p_patch ? 'description' then nullif(btrim(p_patch ->> 'description'), '') else description end, status = case when p_patch ? 'status' then (p_patch ->> 'status')::public.project_status else status end, starts_at = case when p_patch ? 'starts_at' then nullif(p_patch ->> 'starts_at', '')::date else starts_at end, ends_at = case when p_patch ? 'ends_at' then nullif(p_patch ->> 'ends_at', '')::date else ends_at end, billing_type = v_billing, hourly_rate = case when v_billing = 'hourly' then v_rate else null end, hourly_vat_rate = case when v_billing = 'hourly' then coalesce((p_patch ->> 'hourly_vat_rate')::numeric, hourly_vat_rate) else 21 end, github_sync_mode = v_mode, github_auto_sync = case when v_mode = 'bidirectional' then coalesce((p_patch ->> 'github_auto_sync')::boolean, github_auto_sync) else true end, github_repo = v_repo, github_repo_owner = v_owner, github_repo_name = v_repo_name, github_installation_id = case when v_mode = 'bidirectional' then coalesce(nullif(p_patch ->> 'github_installation_id', '')::bigint, github_installation_id) else null end, workspace_paths = v_paths, updated_at = now() where id = p_project_id and version = p_expected_version returning * into v_project;
  if not found then raise exception 'Project version conflict; read it again before updating'; end if;
  insert into public.activity_log(entity_type, entity_id, action, details) values ('project', v_project.id, 'mcp.updated', jsonb_build_object('client_id', v_client_id, 'lead_id', v_lead, 'version', v_project.version));
  return jsonb_build_object('id', v_project.id, 'clientId', v_client_id, 'leadId', v_lead, 'version', v_project.version);
end;
$$;

revoke all on function public.mcp_assert_commercial_relationship(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.mcp_assert_project_client_relationship(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.mcp_validate_proposal_items(jsonb) from public, anon, authenticated;
revoke all on function public.mcp_validate_proposal_patch(jsonb) from public, anon, authenticated;
revoke all on function public.enforce_proposal_project_commercial_relationship() from public, anon, authenticated;
revoke all on function public.mcp_create_proposal(uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.mcp_update_proposal(uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mcp_create_project(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.mcp_update_project(uuid, bigint, uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_create_proposal(uuid, uuid, jsonb, jsonb, uuid) to anon, authenticated;
grant execute on function public.mcp_update_proposal(uuid, bigint, jsonb, jsonb) to anon, authenticated;
grant execute on function public.mcp_create_project(uuid, uuid, jsonb, uuid) to anon, authenticated;
grant execute on function public.mcp_update_project(uuid, bigint, uuid, boolean, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
