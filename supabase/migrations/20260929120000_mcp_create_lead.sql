-- Allow the token-gated MCP to create CRM leads without granting table writes.
alter table public.leads
  add column if not exists mcp_idempotency_key uuid;

create unique index if not exists leads_mcp_idempotency_key_idx
  on public.leads(mcp_idempotency_key)
  where mcp_idempotency_key is not null;

create or replace function public.mcp_create_lead(p_lead jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_assigned_to uuid;
  v_replayed boolean := false;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;

  if p_lead is null or jsonb_typeof(p_lead) <> 'object'
     or p_lead - array[
       'name', 'alias', 'email', 'phone', 'company', 'source', 'language', 'notes',
       'estimated_value', 'assigned_to', 'company_size', 'solution_type', 'urgency'
     ] <> '{}'::jsonb then
    raise exception 'Invalid lead fields';
  end if;
  if exists (
    select 1 from jsonb_each(p_lead) field
    where field.key in (
      'name', 'alias', 'email', 'phone', 'company', 'source', 'language', 'notes',
      'assigned_to', 'company_size', 'solution_type', 'urgency'
    ) and jsonb_typeof(field.value) not in ('string', 'null')
  ) then
    raise exception 'Lead text fields must be strings';
  end if;
  if p_lead ? 'estimated_value'
     and jsonb_typeof(p_lead -> 'estimated_value') not in ('number', 'null') then
    raise exception 'Estimated value must be a number';
  end if;
  if coalesce(length(btrim(p_lead ->> 'name')), 0) not between 1 and 160 then
    raise exception 'Lead name must contain 1 to 160 characters';
  end if;
  if length(coalesce(p_lead ->> 'alias', '')) > 100
     or length(coalesce(p_lead ->> 'email', '')) > 254
     or length(coalesce(p_lead ->> 'phone', '')) > 40
     or length(coalesce(p_lead ->> 'company', '')) > 160
     or length(coalesce(p_lead ->> 'source', '')) > 80
     or length(coalesce(p_lead ->> 'notes', '')) > 4000
     or length(coalesce(p_lead ->> 'company_size', '')) > 80
     or length(coalesce(p_lead ->> 'solution_type', '')) > 80
     or length(coalesce(p_lead ->> 'urgency', '')) > 80 then
    raise exception 'A lead text field is too long';
  end if;
  if nullif(btrim(p_lead ->> 'email'), '') is not null
     and (p_lead ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Lead email is invalid';
  end if;
  if p_lead ? 'language' and p_lead -> 'language' <> 'null'::jsonb
     and p_lead ->> 'language' not in ('es', 'ca', 'en') then
    raise exception 'Lead language is invalid';
  end if;
  if p_lead ? 'estimated_value' and p_lead -> 'estimated_value' <> 'null'::jsonb
     and (p_lead ->> 'estimated_value')::numeric not between 0 and 99999999.99 then
    raise exception 'Estimated value is outside the allowed range';
  end if;

  if p_lead ? 'assigned_to' and p_lead -> 'assigned_to' <> 'null'::jsonb then
    v_assigned_to := (p_lead ->> 'assigned_to')::uuid;
    if not exists (
      select 1 from public.team_members
      where id = v_assigned_to and deleted_at is null and leads_assignable
    ) then
      raise exception 'Lead assignee is not an active assignable team member';
    end if;
  end if;

  if p_idempotency_key is not null then
    select * into v_lead from public.leads
    where mcp_idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'id', v_lead.id, 'name', v_lead.name, 'company', v_lead.company,
        'source', v_lead.source, 'status', v_lead.status::text,
        'assignedTo', v_lead.assigned_to, 'createdAt', v_lead.created_at,
        'idempotentReplay', true
      );
    end if;
  end if;

  insert into public.leads (
    name, alias, email, phone, company, source, language, status, notes, estimated_value,
    assigned_to, company_size, solution_type, urgency, mcp_idempotency_key
  ) values (
    btrim(p_lead ->> 'name'), nullif(btrim(p_lead ->> 'alias'), ''),
    nullif(btrim(p_lead ->> 'email'), ''), nullif(btrim(p_lead ->> 'phone'), ''),
    nullif(btrim(p_lead ->> 'company'), ''),
    coalesce(nullif(btrim(p_lead ->> 'source'), ''), 'MCP'),
    nullif(p_lead ->> 'language', '')::text, 'new',
    nullif(btrim(p_lead ->> 'notes'), ''),
    nullif(p_lead ->> 'estimated_value', '')::numeric,
    v_assigned_to,
    nullif(btrim(p_lead ->> 'company_size'), ''),
    nullif(btrim(p_lead ->> 'solution_type'), ''),
    nullif(btrim(p_lead ->> 'urgency'), ''),
    p_idempotency_key
  ) on conflict (mcp_idempotency_key) where mcp_idempotency_key is not null do nothing
  returning * into v_lead;

  if not found then
    select * into v_lead from public.leads
    where mcp_idempotency_key = p_idempotency_key;
    v_replayed := true;
  else
    insert into public.tasks (
      kind, title, start_at, lead_id, created_by, assignee_id, status, priority
    ) values (
      'reminder',
      'Contactar con ' || coalesce(nullif(v_lead.alias, ''), v_lead.name),
      now() + interval '4 hours', v_lead.id, null, v_assigned_to, 'todo', 'high'
    );
    insert into public.activity_log (entity_type, entity_id, action, details)
    values ('lead', v_lead.id, 'mcp.created', jsonb_build_object('channel', 'mcp'));
  end if;

  return jsonb_build_object(
    'id', v_lead.id, 'name', v_lead.name, 'company', v_lead.company,
    'source', v_lead.source, 'status', v_lead.status::text,
    'assignedTo', v_lead.assigned_to, 'createdAt', v_lead.created_at,
    'idempotentReplay', v_replayed
  );
end;
$$;

revoke all on function public.mcp_create_lead(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.mcp_create_lead(jsonb, uuid) to anon, authenticated;

notify pgrst, 'reload schema';