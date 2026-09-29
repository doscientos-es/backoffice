-- Token-gated MCP RPCs to edit a lead (partial patch) and convert it to a client.
create or replace function public.mcp_update_lead(p_lead_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_assigned_to uuid;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb
     or p_patch - array[
       'name', 'alias', 'email', 'phone', 'company', 'source', 'language', 'notes',
       'estimated_value', 'assigned_to', 'company_size', 'solution_type', 'urgency'
     ] <> '{}'::jsonb then
    raise exception 'Invalid lead fields';
  end if;
  if exists (
    select 1 from jsonb_each(p_patch) f
    where f.key <> 'estimated_value' and jsonb_typeof(f.value) not in ('string', 'null')
  ) then
    raise exception 'Lead text fields must be strings';
  end if;
  if p_patch ? 'name' and coalesce(length(btrim(p_patch ->> 'name')), 0) not between 1 and 160 then
    raise exception 'Lead name must contain 1 to 160 characters';
  end if;
  if p_patch ? 'estimated_value' and jsonb_typeof(p_patch -> 'estimated_value') not in ('number', 'null') then
    raise exception 'Estimated value must be a number';
  end if;
  if p_patch ? 'estimated_value' and p_patch -> 'estimated_value' <> 'null'::jsonb
     and (p_patch ->> 'estimated_value')::numeric not between 0 and 99999999.99 then
    raise exception 'Estimated value is outside the allowed range';
  end if;
  if length(coalesce(p_patch ->> 'alias', '')) > 100
     or length(coalesce(p_patch ->> 'email', '')) > 254
     or length(coalesce(p_patch ->> 'phone', '')) > 40
     or length(coalesce(p_patch ->> 'company', '')) > 160
     or length(coalesce(p_patch ->> 'source', '')) > 80
     or length(coalesce(p_patch ->> 'notes', '')) > 4000
     or length(coalesce(p_patch ->> 'company_size', '')) > 80
     or length(coalesce(p_patch ->> 'solution_type', '')) > 80
     or length(coalesce(p_patch ->> 'urgency', '')) > 80 then
    raise exception 'A lead text field is too long';
  end if;
  if nullif(btrim(p_patch ->> 'email'), '') is not null
     and (p_patch ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Lead email is invalid';
  end if;
  if p_patch ? 'language' and p_patch -> 'language' <> 'null'::jsonb
     and p_patch ->> 'language' not in ('es', 'ca', 'en') then
    raise exception 'Lead language is invalid';
  end if;
  if p_patch ? 'assigned_to' and p_patch -> 'assigned_to' <> 'null'::jsonb then
    v_assigned_to := (p_patch ->> 'assigned_to')::uuid;
    if not exists (
      select 1 from public.team_members
      where id = v_assigned_to and deleted_at is null and leads_assignable
    ) then
      raise exception 'Lead assignee is not an active assignable team member';
    end if;
  end if;

  perform 1 from public.leads where id = p_lead_id and deleted_at is null for update;
  if not found then
    raise exception 'Lead not found';
  end if;

  update public.leads set
    name = case when p_patch ? 'name' then btrim(p_patch ->> 'name') else name end,
    alias = case when p_patch ? 'alias' then nullif(btrim(p_patch ->> 'alias'), '') else alias end,
    email = case when p_patch ? 'email' then nullif(btrim(p_patch ->> 'email'), '') else email end,
    phone = case when p_patch ? 'phone' then nullif(btrim(p_patch ->> 'phone'), '') else phone end,
    company = case when p_patch ? 'company' then nullif(btrim(p_patch ->> 'company'), '') else company end,
    source = case when p_patch ? 'source' then nullif(btrim(p_patch ->> 'source'), '') else source end,
    language = case when p_patch ? 'language' then nullif(p_patch ->> 'language', '') else language end,
    notes = case when p_patch ? 'notes' then nullif(btrim(p_patch ->> 'notes'), '') else notes end,
    estimated_value = case when p_patch ? 'estimated_value' then nullif(p_patch ->> 'estimated_value', '')::numeric else estimated_value end,
    assigned_to = case when p_patch ? 'assigned_to' then v_assigned_to else assigned_to end,
    company_size = case when p_patch ? 'company_size' then nullif(btrim(p_patch ->> 'company_size'), '') else company_size end,
    solution_type = case when p_patch ? 'solution_type' then nullif(btrim(p_patch ->> 'solution_type'), '') else solution_type end,
    urgency = case when p_patch ? 'urgency' then nullif(btrim(p_patch ->> 'urgency'), '') else urgency end,
    updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.activity_log (entity_type, entity_id, action, details)
  values ('lead', v_lead.id, 'mcp.updated', jsonb_build_object('fields', (select jsonb_agg(key) from jsonb_object_keys(p_patch) key)));

  return jsonb_build_object(
    'id', v_lead.id, 'name', v_lead.name, 'alias', v_lead.alias, 'company', v_lead.company,
    'source', v_lead.source, 'status', v_lead.status::text, 'assignedTo', v_lead.assigned_to,
    'updatedAt', v_lead.updated_at
  );
end;
$$;

create or replace function public.mcp_convert_lead_to_client(p_lead_id uuid, p_client jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client_id uuid;
begin
  if not public.has_valid_mcp_access_token() then
    raise exception 'Invalid MCP access token' using errcode = '42501';
  end if;
  if p_client is null or jsonb_typeof(p_client) <> 'object'
     or p_client - array[
       'name', 'label', 'nif', 'email', 'phone', 'contact_person', 'notes',
       'billing_address_street', 'billing_address_zip', 'billing_address_city',
       'billing_address_province', 'billing_address_country'
     ] <> '{}'::jsonb then
    raise exception 'Invalid client fields';
  end if;
  if coalesce(length(btrim(p_client ->> 'name')), 0) = 0
     or coalesce(length(btrim(p_client ->> 'nif')), 0) = 0
     or coalesce(length(btrim(p_client ->> 'billing_address_street')), 0) = 0 then
    raise exception 'Faltan los datos fiscales obligatorios (name, nif, billing_address_street)';
  end if;
  if nullif(btrim(p_client ->> 'email'), '') is not null
     and (p_client ->> 'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Client email is invalid';
  end if;

  perform 1 from public.leads where id = p_lead_id and deleted_at is null for update;
  if not found then
    raise exception 'Lead not found';
  end if;

  select id into v_client_id from public.clients
  where lead_id = p_lead_id and deleted_at is null limit 1;
  if found then
    return jsonb_build_object('clientId', v_client_id, 'leadId', p_lead_id, 'alreadyConverted', true);
  end if;

  insert into public.clients (
    lead_id, name, label, nif, email, phone, contact_person, notes,
    billing_address_street, billing_address_zip, billing_address_city,
    billing_address_province, billing_address_country
  ) values (
    p_lead_id, btrim(p_client ->> 'name'), nullif(btrim(p_client ->> 'label'), ''),
    btrim(p_client ->> 'nif'), nullif(btrim(p_client ->> 'email'), ''),
    nullif(btrim(p_client ->> 'phone'), ''), nullif(btrim(p_client ->> 'contact_person'), ''),
    nullif(btrim(p_client ->> 'notes'), ''), btrim(p_client ->> 'billing_address_street'),
    nullif(btrim(p_client ->> 'billing_address_zip'), ''),
    nullif(btrim(p_client ->> 'billing_address_city'), ''),
    nullif(btrim(p_client ->> 'billing_address_province'), ''),
    coalesce(nullif(btrim(p_client ->> 'billing_address_country'), ''), 'ES')
  ) returning id into v_client_id;

  update public.leads set status = 'won', updated_at = now() where id = p_lead_id;
  insert into public.lead_interactions (lead_id, client_id, type, subject, payload)
  values (
    p_lead_id, v_client_id, 'note', 'Convertido a cliente',
    jsonb_build_object('event', 'lead_converted', 'client_id', v_client_id, 'channel', 'mcp')
  );
  insert into public.activity_log (entity_type, entity_id, action, details)
  values ('lead', p_lead_id, 'mcp.converted', jsonb_build_object('client_id', v_client_id));

  return jsonb_build_object('clientId', v_client_id, 'leadId', p_lead_id, 'alreadyConverted', false);
end;
$$;

revoke all on function public.mcp_update_lead(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mcp_convert_lead_to_client(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mcp_update_lead(uuid, jsonb) to anon, authenticated;
grant execute on function public.mcp_convert_lead_to_client(uuid, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
