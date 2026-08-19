-- Structured, editable payment plans for proposal-driven invoice drafts.
alter table public.proposals
  add column if not exists payment_plan jsonb not null default '[]'::jsonb;

alter table public.invoices
  add column if not exists proposal_payment_plan_item_id text;

create unique index if not exists invoices_proposal_payment_plan_item_unique_idx
  on public.invoices(proposal_id, proposal_payment_plan_item_id)
  where proposal_payment_plan_item_id is not null and deleted_at is null;

comment on column public.proposals.payment_plan is
  'Editable JSON payment milestones: id, title, percentage and optional due_date.';
comment on column public.invoices.proposal_payment_plan_item_id is
  'Payment-plan item that generated this invoice draft; prevents duplicate draft generation.';

-- Keep the versioned item-replacement RPC in sync with the new proposal field.
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
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then
    raise exception 'No autorizado para editar propuestas';
  end if;
  if jsonb_typeof(p_patch) <> 'object'
     or p_patch - array[
       'title', 'valid_until', 'notes', 'context_markdown', 'problems', 'solutions', 'terms',
       'scope_modules', 'deliverables', 'acceptance_criteria', 'payment_schedule', 'payment_plan',
       'payment_terms', 'change_management_terms', 'maintenance_options',
       'maintenance_selected_plan_id', 'maintenance_selection_source', 'maintenance_selected_at'
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

  select
    coalesce(round(sum((item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric)
      filter (where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'), 2), 0),
    coalesce(round(sum((item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric
      * (item.value ->> 'vat_rate')::numeric / 100)
      filter (where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'), 2), 0)
    into v_subtotal, v_tax_amount from jsonb_array_elements(p_items) as item(value);
  v_total := round(v_subtotal + v_tax_amount, 2);

  update public.proposals set
    title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
    valid_until = case when p_patch ? 'valid_until' then nullif(p_patch ->> 'valid_until', '')::date else valid_until end,
    notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,
    context_markdown = case when p_patch ? 'context_markdown' then p_patch ->> 'context_markdown' else context_markdown end,
    problems = case when p_patch ? 'problems' then p_patch -> 'problems' else problems end,
    solutions = case when p_patch ? 'solutions' then p_patch -> 'solutions' else solutions end,
    terms = case when p_patch ? 'terms' then p_patch ->> 'terms' else terms end,
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
    subtotal = v_subtotal, tax_amount = v_tax_amount, total = v_total
  where id = p_proposal_id
  returning proposals.version into version;

  delete from public.proposal_items where proposal_id = p_proposal_id;
  insert into public.proposal_items (proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle)
  select p_proposal_id, item.position - 1, item.value ->> 'description',
    (item.value ->> 'quantity')::numeric, (item.value ->> 'unit_price')::numeric,
    (item.value ->> 'vat_rate')::numeric, coalesce(item.value ->> 'billing_cycle', 'none')::public.expense_recurrence
  from jsonb_array_elements(p_items) with ordinality as item(value, position);

  return next;
end;
$$;
