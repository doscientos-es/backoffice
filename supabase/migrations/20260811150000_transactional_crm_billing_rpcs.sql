-- Transactional write boundaries for CRM and billing.
--
-- These routines deliberately accept only intent-level input. They validate
-- business invariants, derive totals and actor IDs in PostgreSQL, and never
-- call external services. Every exception aborts the whole RPC transaction.

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
    coalesce(round(sum(quantity * unit_price) filter (where billing_cycle = 'none'), 2), 0),
    coalesce(round(sum(quantity * unit_price * vat_rate / 100) filter (where billing_cycle = 'none'), 2), 0)
    into v_subtotal, v_tax_amount
    from jsonb_to_recordset(p_items) as item(
      description text,
      quantity numeric,
      unit_price numeric,
      vat_rate numeric,
      billing_cycle text
    );
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
    item.description,
    item.quantity,
    item.unit_price,
    item.vat_rate,
    coalesce(item.billing_cycle, 'none')::public.expense_recurrence
  from jsonb_to_recordset(p_items) with ordinality as item(
    description text,
    quantity numeric,
    unit_price numeric,
    vat_rate numeric,
    billing_cycle text,
    position bigint
  );

  subtotal := v_subtotal;
  tax_amount := v_tax_amount;
  total := v_total;
  return next;
end;
$$;

create or replace function public.convert_lead_to_client(
  p_lead_id uuid,
  p_name text,
  p_label text,
  p_nif text,
  p_billing_address text,
  p_email text,
  p_phone text,
  p_contact_person text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then
    raise exception 'No autorizado para convertir leads';
  end if;
  if coalesce(length(btrim(p_name)), 0) = 0
     or coalesce(length(btrim(p_nif)), 0) = 0
     or coalesce(length(btrim(p_billing_address)), 0) = 0 then
    raise exception 'Faltan los datos fiscales obligatorios';
  end if;

  perform 1 from public.leads where id = p_lead_id and deleted_at is null for update;
  if not found then
    raise exception 'Lead no encontrado';
  end if;

  select id into v_client_id
    from public.clients
   where lead_id = p_lead_id and deleted_at is null
   limit 1;
  if found then
    return v_client_id;
  end if;

  insert into public.clients (
    lead_id, name, label, nif, billing_address_street, email, phone, contact_person, notes
  ) values (
    p_lead_id, btrim(p_name), nullif(btrim(p_label), ''), btrim(p_nif), btrim(p_billing_address),
    nullif(btrim(p_email), ''), nullif(btrim(p_phone), ''), nullif(btrim(p_contact_person), ''), nullif(btrim(p_notes), '')
  ) returning id into v_client_id;

  update public.leads
     set status = 'won', updated_at = now(), updated_by = auth.uid()
   where id = p_lead_id;
  insert into public.lead_interactions (lead_id, client_id, type, subject, performed_by, payload)
  values (
    p_lead_id, v_client_id, 'note', 'Convertido a cliente', auth.uid(),
    jsonb_build_object('event', 'lead_converted', 'client_id', v_client_id)
  );
  return v_client_id;
end;
$$;

create or replace function public.create_hourly_invoice(
  p_project_id uuid,
  p_month_start date,
  p_month_end date,
  p_month_label text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_series text;
  v_number integer;
  v_invoice_id uuid;
  v_existing_invoice_id uuid;
  v_log_count integer;
  v_linked_log_count integer;
  v_distinct_invoice_count integer;
  v_hours numeric;
  v_updated_count integer;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin', 'member') then
    raise exception 'No autorizado para crear facturas';
  end if;
  if p_month_start <> date_trunc('month', p_month_start)::date
     or p_month_end <> (p_month_start + interval '1 month')::date
     or coalesce(length(btrim(p_month_label)), 0) = 0 then
    raise exception 'Periodo de facturación no válido';
  end if;

  perform pg_advisory_xact_lock(hashtext('hourly-invoice:' || p_project_id::text || ':' || p_month_start::text)::bigint);
  select * into v_project from public.projects where id = p_project_id and deleted_at is null for update;
  if not found then raise exception 'Proyecto no encontrado'; end if;
  if v_project.billing_type <> 'hourly' or coalesce(v_project.hourly_rate, 0) <= 0 then
    raise exception 'El proyecto no tiene facturación por horas válida';
  end if;

  select count(*), count(invoice_id), count(distinct invoice_id), min(invoice_id), coalesce(sum(hours), 0)
    into v_log_count, v_linked_log_count, v_distinct_invoice_count, v_existing_invoice_id, v_hours
    from public.work_logs
   where project_id = p_project_id
     and deleted_at is null
     and work_date >= p_month_start
     and work_date < p_month_end;
  if v_log_count = 0 then raise exception 'No hay horas registradas en ese mes'; end if;
  if v_linked_log_count = v_log_count and v_distinct_invoice_count = 1 then
    perform 1 from public.invoices where id = v_existing_invoice_id and project_id = p_project_id and deleted_at is null;
    if found then return v_existing_invoice_id; end if;
    raise exception 'Las horas ya están vinculadas a una factura no válida';
  end if;
  if v_linked_log_count > 0 then raise exception 'Hay horas del periodo ya facturadas'; end if;

  select * into v_client from public.clients where id = v_project.client_id and deleted_at is null;
  if not found then raise exception 'Cliente no encontrado'; end if;
  select coalesce(nullif(trim(invoice_series), ''), 'A') into v_series from public.settings where id = 1;
  if not found then v_series := 'A'; end if;
  perform pg_advisory_xact_lock(hashtext('invoice-series:' || v_series)::bigint);
  select coalesce(max(number), 0) + 1 into v_number from public.invoices where series = v_series;

  insert into public.invoices (
    client_id, project_id, series, number, status, currency, subtotal, tax_amount, total,
    client_nif, client_name, client_address_street, client_address_zip, client_address_city,
    client_address_province, client_address_country, created_by
  ) values (
    v_project.client_id, v_project.id, v_series, v_number, 'draft', 'EUR',
    round(v_hours * v_project.hourly_rate, 2),
    round(v_hours * v_project.hourly_rate * coalesce(v_project.hourly_vat_rate, 0) / 100, 2),
    round(v_hours * v_project.hourly_rate * (1 + coalesce(v_project.hourly_vat_rate, 0) / 100), 2),
    v_client.nif, v_client.name, v_client.billing_address_street, v_client.billing_address_zip,
    v_client.billing_address_city, v_client.billing_address_province, v_client.billing_address_country, auth.uid()
  ) returning id into v_invoice_id;
  insert into public.invoice_items (invoice_id, position, description, quantity, unit_price, vat_rate)
  values (v_invoice_id, 0, 'Horas trabajadas: ' || btrim(p_month_label), v_hours, v_project.hourly_rate, coalesce(v_project.hourly_vat_rate, 0));

  update public.work_logs
     set invoice_id = v_invoice_id
   where project_id = p_project_id
     and deleted_at is null
     and invoice_id is null
     and work_date >= p_month_start
     and work_date < p_month_end;
  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_log_count then
    raise exception 'Las horas cambiaron mientras se creaba la factura';
  end if;
  return v_invoice_id;
end;
$$;

create or replace function public.create_rectification_invoice(
  p_original_invoice_id uuid,
  p_rectification_type text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original public.invoices%rowtype;
  v_rectification_id uuid;
  v_number integer;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para crear rectificativas';
  end if;
  if p_rectification_type not in ('R1', 'R2', 'R3', 'R4', 'R5') or coalesce(length(btrim(p_reason)), 0) = 0 then
    raise exception 'Datos de rectificación no válidos';
  end if;

  select * into v_original
    from public.invoices
   where id = p_original_invoice_id and deleted_at is null
   for update;
  if not found then raise exception 'Factura original no encontrada'; end if;
  select id into v_rectification_id
    from public.invoices
   where rectified_invoice_id = p_original_invoice_id and deleted_at is null
   limit 1;
  if found then return v_rectification_id; end if;
  if v_original.is_rectification or v_original.status not in ('issued', 'paid', 'overdue') then
    raise exception 'Solo pueden rectificarse facturas emitidas, pagadas o vencidas';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_original_invoice_id) then
    raise exception 'La factura original no tiene líneas';
  end if;

  perform pg_advisory_xact_lock(hashtext('invoice-series:R')::bigint);
  select coalesce(max(number), 0) + 1 into v_number from public.invoices where series = 'R';
  insert into public.invoices (
    client_id, project_id, series, number, invoice_type, status, currency, subtotal, tax_amount, total,
    client_nif, client_name, client_address_street, client_address_zip, client_address_city,
    client_address_province, client_address_country, notes, payment_terms, created_by,
    is_rectification, rectified_invoice_id, rectification_reason, rectification_type
  ) values (
    v_original.client_id, v_original.project_id, 'R', v_number, p_rectification_type::public.invoice_type,
    'draft', v_original.currency, v_original.subtotal, v_original.tax_amount, v_original.total,
    v_original.client_nif, v_original.client_name, v_original.client_address_street, v_original.client_address_zip,
    v_original.client_address_city, v_original.client_address_province, v_original.client_address_country,
    v_original.notes, v_original.payment_terms, auth.uid(), true, v_original.id, btrim(p_reason), p_rectification_type
  ) returning id into v_rectification_id;
  insert into public.invoice_items (invoice_id, position, description, quantity, unit_price, vat_rate)
  select v_rectification_id, position, description, quantity, unit_price, vat_rate
    from public.invoice_items where invoice_id = v_original.id order by position;
  update public.invoices set status = 'rectified', paid_at = null where id = v_original.id;
  return v_rectification_id;
end;
$$;

revoke all on function public.replace_proposal_items(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.convert_lead_to_client(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_hourly_invoice(uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.create_rectification_invoice(uuid, text, text) from public, anon, authenticated;
grant execute on function public.replace_proposal_items(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.convert_lead_to_client(uuid, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_hourly_invoice(uuid, date, date, text) to authenticated;
grant execute on function public.create_rectification_invoice(uuid, text, text) to authenticated;
