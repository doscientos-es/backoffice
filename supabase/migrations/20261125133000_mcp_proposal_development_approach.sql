-- Extend only the token-checked MCP proposal functions, without altering their
-- authorization, concurrency checks, pricing or existing timeline behavior.
do $migration$
declare
  validator text := pg_get_functiondef('public.mcp_validate_proposal_patch(jsonb)'::regprocedure);
  creator text := pg_get_functiondef('public.mcp_create_proposal(uuid,uuid,jsonb,jsonb,uuid)'::regprocedure);
  updater text := pg_get_functiondef('public.mcp_update_proposal(uuid,bigint,jsonb,jsonb)'::regprocedure);
  fields text := $old$'maintenance_selected_plan_id', 'project_id', 'timeline'$old$;
  validate_anchor text := $old$  if p_patch ? 'title' and coalesce(length(btrim(p_patch ->> 'title')), 0) not between 1 and 200 then$old$;
  columns_anchor text := $old$maintenance_options, maintenance_selected_plan_id, mcp_idempotency_key, timeline$old$;
  values_anchor text := $old$p_idempotency_key, coalesce(p_patch -> 'timeline', '[]'::jsonb)$old$;
  update_anchor text := $old$    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total, updated_at = now()$old$;
begin
  if length(validator) - length(replace(validator, fields, '')) <> length(fields)
    or length(validator) - length(replace(validator, validate_anchor, '')) <> length(validate_anchor)
    or length(creator) - length(replace(creator, columns_anchor, '')) <> length(columns_anchor)
    or length(creator) - length(replace(creator, values_anchor, '')) <> length(values_anchor)
    or length(updater) - length(replace(updater, update_anchor, '')) <> length(update_anchor) then
    raise exception 'Unexpected MCP proposal function definition';
  end if;
  validator := replace(validator, fields, fields || ', ''development_approach''');
  validator := replace(validator, validate_anchor,
    $new$  if p_patch ? 'development_approach' and (jsonb_typeof(p_patch -> 'development_approach') not in ('string', 'null') or coalesce(length(p_patch ->> 'development_approach'), 0) > 20000) then raise exception 'Invalid development approach'; end if;$new$ || E'\n' || validate_anchor);
  creator := replace(creator, columns_anchor, columns_anchor || ', development_approach');
  creator := replace(creator, values_anchor,
    values_anchor || $new$, nullif(btrim(p_patch ->> 'development_approach'), '')$new$);
  updater := replace(updater, update_anchor,
    $new$    development_approach = case when p_patch ? 'development_approach' then nullif(btrim(p_patch ->> 'development_approach'), '') else development_approach end,$new$ || E'\n' || update_anchor);
  execute validator;
  execute creator;
  execute updater;
end;
$migration$;

grant select (development_approach) on public.proposals to anon;
notify pgrst, 'reload schema';