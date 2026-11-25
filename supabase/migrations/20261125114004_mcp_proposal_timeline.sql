-- Validate MCP timelines independently of the MCP client; the portal expects
-- every milestone to have a UUID, title, description and valid inclusive dates.
create function public.mcp_validate_proposal_timeline(p_timeline jsonb)
returns void language plpgsql set search_path = public as $$
declare item jsonb; start_text text; end_text text;
begin
  if jsonb_typeof(p_timeline) is distinct from 'array' then
    raise exception 'Proposal timeline must be an array';
  end if;
  if jsonb_array_length(p_timeline) > 60 then
    raise exception 'Proposal timeline cannot exceed 60 milestones';
  end if;
  for item in select value from jsonb_array_elements(p_timeline) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item -> 'id') is distinct from 'string'
      or (item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(item -> 'title') is distinct from 'string'
      or length(btrim(item ->> 'title')) not between 1 and 120
      or jsonb_typeof(item -> 'description') is distinct from 'string'
      or length(item ->> 'description') > 500
      or jsonb_typeof(item -> 'start_date') is distinct from 'string'
      or jsonb_typeof(item -> 'end_date') is distinct from 'string' then
      raise exception 'Invalid proposal timeline milestone';
    end if;
    start_text := item ->> 'start_date';
    end_text := item ->> 'end_date';
    if start_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or end_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or start_text < '1900-01-01' or end_text > '9998-12-31'
      or end_text < start_text then
      raise exception 'Invalid proposal timeline dates';
    end if;
    begin
      perform start_text::date, end_text::date;
    exception when datetime_field_overflow or invalid_datetime_format then
      raise exception 'Invalid proposal timeline dates';
    end;
  end loop;
end;
$$;
revoke all on function public.mcp_validate_proposal_timeline(jsonb) from public, anon, authenticated;

-- Extend the live token-checked RPCs without replacing unrelated behavior.
-- Stop rather than overwrite a function whose definition has drifted.
do $migration$
declare
  validator text := pg_get_functiondef('public.mcp_validate_proposal_patch(jsonb)'::regprocedure);
  creator text := pg_get_functiondef('public.mcp_create_proposal(uuid,uuid,jsonb,jsonb,uuid)'::regprocedure);
  updater text := pg_get_functiondef('public.mcp_update_proposal(uuid,bigint,jsonb,jsonb)'::regprocedure);
  fields text := $old$'maintenance_selected_plan_id', 'project_id'$old$;
  validate_anchor text := $old$  if p_patch ? 'title' and coalesce(length(btrim(p_patch ->> 'title')), 0) not between 1 and 200 then$old$;
  columns_anchor text := $old$maintenance_options, maintenance_selected_plan_id, mcp_idempotency_key$old$;
  values_anchor text := $old$nullif(p_patch -> 'maintenance_options', 'null'::jsonb), nullif(btrim(p_patch ->> 'maintenance_selected_plan_id'), ''), p_idempotency_key$old$;
  update_anchor text := $old$    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total, updated_at = now()$old$;
begin
  if length(validator) - length(replace(validator, fields, '')) <> length(fields)
    or length(validator) - length(replace(validator, validate_anchor, '')) <> length(validate_anchor)
    or length(creator) - length(replace(creator, columns_anchor, '')) <> length(columns_anchor)
    or length(creator) - length(replace(creator, values_anchor, '')) <> length(values_anchor)
    or length(updater) - length(replace(updater, update_anchor, '')) <> length(update_anchor) then
    raise exception 'Unexpected MCP proposal function definition';
  end if;
  validator := replace(validator, fields, fields || ', ''timeline''');
  validator := replace(validator, validate_anchor,
    $new$  if p_patch ? 'timeline' then perform public.mcp_validate_proposal_timeline(p_patch -> 'timeline'); end if;$new$ || E'\n' || validate_anchor);
  creator := replace(creator, columns_anchor, columns_anchor || ', timeline');
  creator := replace(creator, values_anchor,
    values_anchor || $new$, coalesce(p_patch -> 'timeline', '[]'::jsonb)$new$);
  updater := replace(updater, update_anchor,
    $new$    timeline = case when p_patch ? 'timeline' then p_patch -> 'timeline' else timeline end,$new$ || E'\n' || update_anchor);
  execute validator;
  execute creator;
  execute updater;
end;
$migration$;
notify pgrst, 'reload schema';