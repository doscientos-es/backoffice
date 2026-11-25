-- MCP payloads use camelCase for items. Delegate the pricing calculation to the
-- same function as the backoffice, after validating the effective discount.
create function public.mcp_proposal_discount_totals(p_items jsonb, p_type text, p_value numeric)
returns table (subtotal numeric, tax_amount numeric)
language plpgsql set search_path = public as $$
begin
  if p_type not in ('none', 'percent', 'amount') or p_value < 0 or p_value > 100000000
    or (p_type = 'percent' and p_value > 100) then
    raise exception 'Invalid proposal discount';
  end if;
  return query select t.subtotal, t.tax_amount from public.proposal_net_totals(
    (select jsonb_agg(jsonb_build_object(
      'quantity', value -> 'quantity', 'unit_price', value -> 'unitPrice',
      'vat_rate', coalesce(value -> 'vatRate', '21'::jsonb),
      'billing_cycle', coalesce(value -> 'billingCycle', '"none"'::jsonb),
      'discount_percent', coalesce(value -> 'discountPercent', '0'::jsonb)
    )) from jsonb_array_elements(p_items)), p_type, p_value
  ) t;
end;
$$;
revoke all on function public.mcp_proposal_discount_totals(jsonb, text, numeric) from public, anon, authenticated;

-- Refuse to patch unexpected versions of the existing token-checked RPCs.
do $migration$
declare
  items_validator text := pg_get_functiondef('public.mcp_validate_proposal_items(jsonb)'::regprocedure);
  validator text := pg_get_functiondef('public.mcp_validate_proposal_patch(jsonb)'::regprocedure);
  creator text := pg_get_functiondef('public.mcp_create_proposal(uuid,uuid,jsonb,jsonb,uuid)'::regprocedure);
  updater text := pg_get_functiondef('public.mcp_update_proposal(uuid,bigint,jsonb,jsonb)'::regprocedure);
  item_anchor text := $old$  ) then raise exception 'Proposal line items are invalid'; end if;$old$;
  fields_anchor text := $old$'timeline', 'development_approach'$old$;
  validate_anchor text := $old$  if p_patch ? 'title' and coalesce(length(btrim(p_patch ->> 'title')), 0) not between 1 and 200 then$old$;
  total_anchor text := $old$  select coalesce(round(sum((value ->> 'quantity')::numeric * (value ->> 'unitPrice')::numeric)
    filter (where coalesce(value ->> 'billingCycle', 'none') = 'none'), 2), 0),
    coalesce(round(sum((value ->> 'quantity')::numeric * (value ->> 'unitPrice')::numeric * coalesce((value ->> 'vatRate')::numeric, 21) / 100)
    filter (where coalesce(value ->> 'billingCycle', 'none') = 'none'), 2), 0)
  into v_subtotal, v_tax_amount from jsonb_array_elements(p_items);$old$;
  columns_anchor text := $old$maintenance_options, maintenance_selected_plan_id, mcp_idempotency_key, timeline, development_approach$old$;
  values_anchor text := $old$nullif(btrim(p_patch ->> 'development_approach'), '')$old$;
  item_columns text := $old$insert into public.proposal_items (proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle)$old$;
  item_values text := $old$coalesce(value ->> 'billingCycle', 'none')::public.expense_recurrence$old$;
  update_anchor text := $old$    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total, updated_at = now()$old$;
  delete_anchor text := $old$  delete from public.proposal_items where proposal_id = p_proposal_id;$old$;
  empty_patch text := $old$  if p_patch = '{}'::jsonb then raise exception 'At least one proposal field must be provided'; end if;$old$;
  declare_anchor text := $old$declare v_subtotal numeric(12,2); v_tax_amount numeric(12,2); v_total numeric(12,2);$old$;
  relationship_anchor text := $old$  perform public.mcp_assert_commercial_relationship(v_current.client_id, v_current.lead_id, v_project_id);$old$;
begin
  if length(items_validator) - length(replace(items_validator, item_anchor, '')) <> length(item_anchor)
    or length(validator) - length(replace(validator, fields_anchor, '')) <> length(fields_anchor)
    or length(validator) - length(replace(validator, validate_anchor, '')) <> length(validate_anchor)
    or length(creator) - length(replace(creator, total_anchor, '')) <> length(total_anchor)
    or length(updater) - length(replace(updater, total_anchor, '')) <> length(total_anchor)
    or length(creator) - length(replace(creator, columns_anchor, '')) <> length(columns_anchor)
    or length(creator) - length(replace(creator, values_anchor, '')) <> length(values_anchor)
    or length(creator) - length(replace(creator, item_columns, '')) <> length(item_columns)
    or length(updater) - length(replace(updater, item_columns, '')) <> length(item_columns)
    or length(creator) - length(replace(creator, item_values, '')) <> length(item_values)
    or length(updater) - length(replace(updater, item_values, '')) <> length(item_values)
    or length(updater) - length(replace(updater, update_anchor, '')) <> length(update_anchor)
    or length(updater) - length(replace(updater, delete_anchor, '')) <> length(delete_anchor)
    or length(updater) - length(replace(updater, empty_patch, '')) <> length(empty_patch)
    or length(updater) - length(replace(updater, declare_anchor, '')) <> length(declare_anchor)
    or length(updater) - length(replace(updater, relationship_anchor, '')) <> length(relationship_anchor) then
    raise exception 'Unexpected MCP proposal function definition';
  end if;

  items_validator := replace(items_validator, item_anchor, item_anchor || $new$
  if exists (select 1 from jsonb_array_elements(p_items) as item(value) where
    (value ? 'discountPercent' and case when jsonb_typeof(value -> 'discountPercent') = 'number'
      then (value ->> 'discountPercent')::numeric not between 0 and 100
        or (value ->> 'discountPercent')::numeric <> round((value ->> 'discountPercent')::numeric, 2)
      else true end)
    or (value ? 'discountReason' and (jsonb_typeof(value -> 'discountReason') not in ('string', 'null')
      or length(value ->> 'discountReason') > 200))) then
    raise exception 'Invalid proposal line discount';
  end if;$new$);
  validator := replace(validator, fields_anchor, fields_anchor || ', ''discount_type'', ''discount_value'', ''discount_reason''');
  validator := replace(validator, validate_anchor, $new$  if (p_patch ? 'discount_type' and (jsonb_typeof(p_patch -> 'discount_type') <> 'string' or p_patch ->> 'discount_type' not in ('none', 'percent', 'amount')))
    or (p_patch ? 'discount_value' and case when jsonb_typeof(p_patch -> 'discount_value') = 'number'
      then (p_patch ->> 'discount_value')::numeric not between 0 and 100000000
        or (p_patch ->> 'discount_value')::numeric <> round((p_patch ->> 'discount_value')::numeric, 2)
      else true end)
    or (p_patch ? 'discount_reason' and (jsonb_typeof(p_patch -> 'discount_reason') not in ('string', 'null') or length(p_patch ->> 'discount_reason') > 200)) then
    raise exception 'Invalid proposal discount';
  end if;
$new$ || validate_anchor);
  creator := replace(creator, total_anchor, $new$  select t.subtotal, t.tax_amount into v_subtotal, v_tax_amount from public.mcp_proposal_discount_totals(
    p_items, coalesce(p_patch ->> 'discount_type', 'none'), coalesce((p_patch ->> 'discount_value')::numeric, 0)) t;$new$);
  creator := replace(creator, columns_anchor, columns_anchor || ', discount_type, discount_value, discount_reason');
  creator := replace(creator, values_anchor, values_anchor || $new$, coalesce(p_patch ->> 'discount_type', 'none'),
    case when coalesce(p_patch ->> 'discount_type', 'none') = 'none' then 0 else coalesce((p_patch ->> 'discount_value')::numeric, 0) end,
    case when coalesce(p_patch ->> 'discount_type', 'none') = 'none' then null else nullif(btrim(p_patch ->> 'discount_reason'), '') end$new$);
  updater := replace(updater, declare_anchor, declare_anchor || E'\n' || 'declare v_discount_type text; v_discount_value numeric;');
  updater := replace(updater, empty_patch, '');
  updater := replace(updater, relationship_anchor, relationship_anchor || $new$
  v_discount_type := coalesce(p_patch ->> 'discount_type', v_current.discount_type);
  v_discount_value := coalesce((p_patch ->> 'discount_value')::numeric, v_current.discount_value);
  if v_discount_type = 'none' then v_discount_value := 0; end if;$new$);
  updater := replace(updater, total_anchor, $new$  select t.subtotal, t.tax_amount into v_subtotal, v_tax_amount
    from public.mcp_proposal_discount_totals(p_items, v_discount_type, v_discount_value) t;$new$);
  updater := replace(updater, update_anchor, $new$    discount_type = v_discount_type, discount_value = v_discount_value,
    discount_reason = case when v_discount_type = 'none' then null when p_patch ? 'discount_reason' then nullif(btrim(p_patch ->> 'discount_reason'), '') else discount_reason end,
$new$ || update_anchor);
  updater := replace(updater, delete_anchor, $new$  if exists (select 1 from public.proposal_items where proposal_id = p_proposal_id and discount_percent > 0)
    and exists (select 1 from jsonb_array_elements(p_items) where not (value ? 'discountPercent')) then
    raise exception 'Read and include every line discount before editing';
  end if;
  if exists (select 1 from public.proposal_items where proposal_id = p_proposal_id and discount_reason is not null)
    and exists (select 1 from jsonb_array_elements(p_items) where not (value ? 'discountReason')) then
    raise exception 'Read and include every line discount reason before editing';
  end if;
$new$ || delete_anchor);
  creator := replace(creator, item_columns, replace(item_columns, 'billing_cycle)', 'billing_cycle, discount_percent, discount_reason)'));
  updater := replace(updater, item_columns, replace(item_columns, 'billing_cycle)', 'billing_cycle, discount_percent, discount_reason)'));
  creator := replace(creator, item_values, item_values || $new$, coalesce((value ->> 'discountPercent')::numeric, 0),
    case when coalesce((value ->> 'discountPercent')::numeric, 0) > 0 then nullif(btrim(value ->> 'discountReason'), '') end$new$);
  updater := replace(updater, item_values, item_values || $new$, coalesce((value ->> 'discountPercent')::numeric, 0),
    case when coalesce((value ->> 'discountPercent')::numeric, 0) > 0 then nullif(btrim(value ->> 'discountReason'), '') end$new$);
  execute items_validator;
  execute validator;
  execute creator;
  execute updater;
end;
$migration$;

grant select (discount_type, discount_value, discount_reason) on public.proposals to anon;
grant select (discount_percent, discount_reason) on public.proposal_items to anon;
notify pgrst, 'reload schema';