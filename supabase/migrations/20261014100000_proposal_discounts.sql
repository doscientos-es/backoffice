-- Proposal discounts.
-- * Per line: proposal_items.discount_percent (0..100) + optional reason.
-- * Whole proposal: discount_type ('none' | 'percent' | 'amount'), value, reason.
--   The global discount only applies to one-time lines (billing_cycle = 'none');
--   recurring lines keep their own per-line discounts only.
-- proposal_items.subtotal stays GROSS (quantity * unit_price); proposals.subtotal,
-- tax_amount and total are stored NET of every discount.

alter table public.proposal_items
  add column if not exists discount_percent numeric(5,2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists discount_reason text
    check (discount_reason is null or length(discount_reason) <= 200);

alter table public.proposals
  add column if not exists discount_type text not null default 'none'
    check (discount_type in ('none', 'percent', 'amount')),
  add column if not exists discount_value numeric(12,2) not null default 0
    check (discount_value >= 0),
  add column if not exists discount_reason text
    check (discount_reason is null or length(discount_reason) <= 200),
  add constraint proposals_discount_percent_max
    check (discount_type <> 'percent' or discount_value <= 100);

-- One-time totals (net of discounts) from the editor's item payload (snake_case keys).
create or replace function public.proposal_net_totals(
  p_items jsonb, p_discount_type text, p_discount_value numeric
)
returns table (subtotal numeric, tax_amount numeric)
language plpgsql
immutable
set search_path = public
as $$
declare
  v_net numeric;
  v_tax numeric;
  v_discount numeric := 0;
  v_factor numeric := 1;
begin
  select
    coalesce(sum(n.net), 0),
    coalesce(sum(n.net * n.vat / 100), 0)
  into v_net, v_tax
  from (
    select
      (item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric
        * (1 - coalesce((item.value ->> 'discount_percent')::numeric, 0) / 100) as net,
      (item.value ->> 'vat_rate')::numeric as vat
    from jsonb_array_elements(p_items) as item(value)
    where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'
  ) n;

  if v_net > 0 then
    if p_discount_type = 'percent' then
      v_discount := v_net * least(coalesce(p_discount_value, 0), 100) / 100;
    elsif p_discount_type = 'amount' then
      v_discount := least(coalesce(p_discount_value, 0), v_net);
    end if;
    v_factor := (v_net - v_discount) / v_net;
  end if;

  subtotal := round(v_net - v_discount, 2);
  tax_amount := round(v_tax * v_factor, 2);
  return next;
end;
$$;

create or replace function public.update_proposal_items_versioned(
  p_proposal_id uuid,
  p_expected_version bigint,
  p_patch jsonb,
  p_items jsonb
)
returns table (version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.proposals%rowtype;
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_total numeric(12,2);
  v_discount_type text;
  v_discount_value numeric(12,2);
begin
  if not (public.has_permission('proposals.write') and public.has_permission('proposals.prices') and public.can_access_proposal(p_proposal_id)) then
    raise exception 'No autorizado para editar propuestas';
  end if;
  if jsonb_typeof(p_patch) <> 'object'
     or p_patch - array[
       'title', 'valid_until', 'notes', 'context_markdown', 'problems', 'solutions', 'terms',
       'legal_terms', 'scope_modules', 'deliverables', 'acceptance_criteria', 'payment_schedule',
       'payment_plan', 'payment_terms', 'change_management_terms', 'maintenance_options',
       'maintenance_selected_plan_id', 'maintenance_selection_source', 'maintenance_selected_at',
       'discount_type', 'discount_value', 'discount_reason'
     ] <> '{}'::jsonb then
    raise exception 'Campos de propuesta no válidos';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La propuesta debe tener al menos una línea';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or coalesce(length(btrim(item.value ->> 'description')), 0) = 0
      or length(item.value ->> 'description') > 500
      or jsonb_typeof(item.value -> 'quantity') <> 'number'
      or jsonb_typeof(item.value -> 'unit_price') <> 'number'
      or jsonb_typeof(item.value -> 'vat_rate') <> 'number'
      or (item.value ->> 'quantity')::numeric <= 0
      or (item.value ->> 'unit_price')::numeric < 0
      or (item.value ->> 'vat_rate')::numeric not between 0 and 100
      or coalesce(item.value ->> 'billing_cycle', 'none') not in ('none', 'monthly', 'quarterly', 'yearly')
      or (item.value ? 'discount_percent' and (
        jsonb_typeof(item.value -> 'discount_percent') <> 'number'
        or (item.value ->> 'discount_percent')::numeric not between 0 and 100))
      or length(coalesce(item.value ->> 'discount_reason', '')) > 200
  ) then
    raise exception 'Las líneas de propuesta no son válidas';
  end if;

  select * into v_proposal from public.proposals
    where id = p_proposal_id and deleted_at is null for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if v_proposal.version <> p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
  if v_proposal.status in ('accepted', 'rejected') then
    raise exception 'La propuesta ya ha sido respondida y no se puede editar';
  end if;

  v_discount_type := case when p_patch ? 'discount_type' then p_patch ->> 'discount_type' else v_proposal.discount_type end;
  v_discount_value := case when p_patch ? 'discount_value' then (p_patch ->> 'discount_value')::numeric else v_proposal.discount_value end;
  if v_discount_type not in ('none', 'percent', 'amount')
     or v_discount_value < 0
     or (v_discount_type = 'percent' and v_discount_value > 100) then
    raise exception 'Descuento no válido';
  end if;
  if v_discount_type = 'none' then v_discount_value := 0; end if;

  select t.subtotal, t.tax_amount into v_subtotal, v_tax_amount
    from public.proposal_net_totals(p_items, v_discount_type, v_discount_value) t;
  v_total := round(v_subtotal + v_tax_amount, 2);

  update public.proposals set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
    valid_until = case when p_patch ? 'valid_until' then nullif(p_patch ->> 'valid_until', '')::date else valid_until end,
    notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,
    context_markdown = case when p_patch ? 'context_markdown' then p_patch ->> 'context_markdown' else context_markdown end,
    problems = case when p_patch ? 'problems' then p_patch -> 'problems' else problems end,
    solutions = case when p_patch ? 'solutions' then p_patch -> 'solutions' else solutions end,
    terms = case when p_patch ? 'terms' then p_patch ->> 'terms' else terms end,
    legal_terms = case when p_patch ? 'legal_terms' then coalesce(nullif(btrim(p_patch ->> 'legal_terms'), ''), legal_terms) else legal_terms end,
    scope_modules = case when p_patch ? 'scope_modules' then p_patch -> 'scope_modules' else scope_modules end,
    deliverables = case when p_patch ? 'deliverables' then p_patch ->> 'deliverables' else deliverables end,
    acceptance_criteria = case when p_patch ? 'acceptance_criteria' then p_patch ->> 'acceptance_criteria' else acceptance_criteria end,
    payment_schedule = case when p_patch ? 'payment_schedule' then p_patch ->> 'payment_schedule' else payment_schedule end,
    payment_plan = case when p_patch ? 'payment_plan' then p_patch -> 'payment_plan' else payment_plan end,
    payment_terms = case when p_patch ? 'payment_terms' then p_patch ->> 'payment_terms' else payment_terms end,
    change_management_terms = case when p_patch ? 'change_management_terms' then p_patch ->> 'change_management_terms' else change_management_terms end,
    maintenance_options = case when p_patch ? 'maintenance_options' then p_patch -> 'maintenance_options' else maintenance_options end,
    maintenance_selected_plan_id = case when p_patch ? 'maintenance_selected_plan_id' then p_patch ->> 'maintenance_selected_plan_id' else maintenance_selected_plan_id end,
    maintenance_selection_source = case when p_patch ? 'maintenance_selection_source' then p_patch ->> 'maintenance_selection_source' else maintenance_selection_source end,
    maintenance_selected_at = case when p_patch ? 'maintenance_selected_at' then (p_patch ->> 'maintenance_selected_at')::timestamptz else maintenance_selected_at end,
    discount_type = v_discount_type,
    discount_value = v_discount_value,
    discount_reason = case
      when v_discount_type = 'none' then null
      when p_patch ? 'discount_reason' then nullif(btrim(p_patch ->> 'discount_reason'), '')
      else discount_reason end,
    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total
  where id = p_proposal_id
  returning proposals.version into version;

  delete from public.proposal_items where proposal_id = p_proposal_id;
  insert into public.proposal_items (proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle, discount_percent, discount_reason)
  select p_proposal_id, item.position - 1, item.value ->> 'description',
    (item.value ->> 'quantity')::numeric, (item.value ->> 'unit_price')::numeric,
    (item.value ->> 'vat_rate')::numeric, coalesce(item.value ->> 'billing_cycle', 'none')::public.expense_recurrence,
    coalesce((item.value ->> 'discount_percent')::numeric, 0),
    case when coalesce((item.value ->> 'discount_percent')::numeric, 0) > 0
      then nullif(btrim(item.value ->> 'discount_reason'), '') end
  from jsonb_array_elements(p_items) with ordinality as item(value, position);

  return next;
end;
$$;

revoke all on function public.update_proposal_items_versioned(uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.update_proposal_items_versioned(uuid, bigint, jsonb, jsonb) to authenticated;

-- Discount fields are pricing data: expose them through the permission-checked
-- views (authenticated has column-level SELECT on proposals). Columns are only
-- appended so CREATE OR REPLACE VIEW keeps existing columns intact.
create or replace view public.proposal_prices
with (security_barrier = true)
as
  select p.id as proposal_id, p.subtotal, p.tax_amount, p.total,
    p.maintenance_options, p.payment_terms,
    p.discount_type, p.discount_value, p.discount_reason
  from public.proposals p
  where public.has_permission('proposals.prices')
    and public.can_access_proposal(p.id);

create or replace view public.client_portal_proposal_prices
with (security_barrier = true)
as
  select p.id as proposal_id, p.subtotal, p.tax_amount, p.total,
    p.maintenance_options, p.payment_terms,
    p.discount_type, p.discount_value, p.discount_reason
  from public.proposals p
  where p.deleted_at is null
    and p.status <> 'draft'
    and exists (
      select 1 from public.client_portal_access access
      where access.client_id = p.client_id
        and access.user_id = auth.uid()
        and access.enabled = true
    );
