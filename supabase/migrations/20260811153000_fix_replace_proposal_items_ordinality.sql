-- Correct the proposal item replacement RPC for PostgreSQL's WITH ORDINALITY
-- syntax. jsonb_to_recordset cannot accept a column definition list together
-- with WITH ORDINALITY, so derive each typed value from the JSON element.

create or replace function public.replace_proposal_items(
  p_proposal_id uuid,
  p_patch jsonb,
  p_items jsonb
)
returns table (subtotal numeric, tax_amount numeric, total numeric)
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
     or p_patch - array['title', 'valid_until', 'notes', 'context_markdown', 'problems', 'solutions', 'terms'] <> '{}'::jsonb then
    raise exception 'Campos de propuesta no válidos';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La propuesta debe tener al menos una línea';
  end if;
  if exists (
    select 1
      from jsonb_array_elements(p_items) as item(value)
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

  select * into v_proposal
    from public.proposals
   where id = p_proposal_id and deleted_at is null
   for update;
  if not found then
    raise exception 'Propuesta no encontrada';
  end if;
  if v_proposal.status in ('accepted', 'rejected') then
    raise exception 'La propuesta ya ha sido respondida y no se puede editar';
  end if;

  select
    coalesce(round(sum((item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric)
      filter (where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'), 2), 0),
    coalesce(round(sum((item.value ->> 'quantity')::numeric * (item.value ->> 'unit_price')::numeric
      * (item.value ->> 'vat_rate')::numeric / 100)
      filter (where coalesce(item.value ->> 'billing_cycle', 'none') = 'none'), 2), 0)
    into v_subtotal, v_tax_amount
    from jsonb_array_elements(p_items) as item(value);
  v_total := round(v_subtotal + v_tax_amount, 2);

  update public.proposals
     set title = case when p_patch ? 'title' then p_patch ->> 'title' else title end,
         valid_until = case when p_patch ? 'valid_until' then nullif(p_patch ->> 'valid_until', '')::date else valid_until end,
         notes = case when p_patch ? 'notes' then p_patch ->> 'notes' else notes end,
         context_markdown = case when p_patch ? 'context_markdown' then p_patch ->> 'context_markdown' else context_markdown end,
         problems = case when p_patch ? 'problems' then p_patch -> 'problems' else problems end,
         solutions = case when p_patch ? 'solutions' then p_patch -> 'solutions' else solutions end,
         terms = case when p_patch ? 'terms' then p_patch ->> 'terms' else terms end,
         subtotal = v_subtotal,
         tax_amount = v_tax_amount,
         total = v_total
   where id = p_proposal_id;

  delete from public.proposal_items where proposal_id = p_proposal_id;
  insert into public.proposal_items (
    proposal_id, position, description, quantity, unit_price, vat_rate, billing_cycle
  )
  select
    p_proposal_id,
    item.position - 1,
    item.value ->> 'description',
    (item.value ->> 'quantity')::numeric,
    (item.value ->> 'unit_price')::numeric,
    (item.value ->> 'vat_rate')::numeric,
    coalesce(item.value ->> 'billing_cycle', 'none')::public.expense_recurrence
  from jsonb_array_elements(p_items) with ordinality as item(value, position);

  subtotal := v_subtotal;
  tax_amount := v_tax_amount;
  total := v_total;
  return next;
end;
$$;