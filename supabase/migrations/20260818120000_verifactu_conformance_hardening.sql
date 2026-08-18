-- Freeze the producer/SIF identity used by every record and distinguish
-- terminal local failures from AEAT/network incidents. Existing immutable
-- records are deliberately left untouched.

alter table public.verifactu_outbox
  add column if not exists incidence boolean not null default false;

alter table public.verifactu_outbox
  drop constraint if exists verifactu_outbox_state_check;
alter table public.verifactu_outbox
  add constraint verifactu_outbox_state_check
  check (state in ('queued', 'processing', 'accepted', 'rejected', 'retryable_error', 'terminal_error'));

create table if not exists public.verifactu_submission_control (
  issuer_nif text primary key,
  last_submission_at timestamptz,
  wait_seconds integer not null default 60 check (wait_seconds between 0 and 86400),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.verifactu_submission_control enable row level security;
revoke all on table public.verifactu_submission_control from public, anon, authenticated;

create or replace function public.issue_invoice_with_verifactu_outbox(
  p_invoice_id uuid,
  p_software jsonb
)
returns table (ledger_id uuid, outbox_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_client public.clients%rowtype;
  v_nif text;
  v_company_name text;
  v_previous public.verifactu_ledger%rowtype;
  v_generated_at timestamptz := clock_timestamp();
  v_generated_at_local text;
  v_hash_payload text;
  v_hash text;
  v_vat_lines jsonb;
  v_description text;
  v_rectified public.invoices%rowtype;
  v_rectified_ledger public.verifactu_ledger%rowtype;
  v_rectification_method text;
  v_ledger_id uuid;
  v_outbox_id uuid;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para emitir facturas';
  end if;
  if jsonb_typeof(p_software) <> 'object'
     or coalesce(nullif(trim(p_software->>'producerName'), ''), '') = ''
     or coalesce(nullif(trim(p_software->>'producerNif'), ''), '') = ''
     or coalesce(nullif(trim(p_software->>'name'), ''), '') = ''
     or coalesce(nullif(trim(p_software->>'id'), ''), '') = ''
     or coalesce(nullif(trim(p_software->>'version'), ''), '') = ''
     or coalesce(nullif(trim(p_software->>'installationNumber'), ''), '') = '' then
    raise exception 'Falta la identidad inmutable del productor o del SIF';
  end if;

  select trim(company_nif), coalesce(company_name, '') into v_nif, v_company_name
    from public.settings where id = 1;
  if coalesce(v_nif, '') = '' then raise exception 'Falta el NIF de la empresa en Ajustes'; end if;
  perform pg_advisory_xact_lock(hashtext('verifactu:' || v_nif)::bigint);

  select * into v_invoice from public.invoices
    where id = p_invoice_id and deleted_at is null for update;
  if not found then raise exception 'Factura no encontrada'; end if;

  select l.id, o.id into v_ledger_id, v_outbox_id
    from public.verifactu_ledger l join public.verifactu_outbox o on o.ledger_id = l.id
    where l.invoice_id = v_invoice.id and l.record_type = 'alta';
  if found then ledger_id := v_ledger_id; outbox_id := v_outbox_id; return next; return; end if;
  if v_invoice.status <> 'draft' then raise exception 'Solo se puede emitir una factura en borrador'; end if;
  if v_invoice.verifactu_status = 'excluded' then raise exception 'Esta factura está excluida de VERI*FACTU'; end if;
  if v_invoice.invoice_type not in ('F1', 'F2', 'R1', 'R2', 'R3', 'R4', 'R5') then
    raise exception 'El tipo de factura % no está soportado por VERI*FACTU', v_invoice.invoice_type;
  end if;
  if v_invoice.invoice_type::text like 'R%' then
    if not coalesce(v_invoice.is_rectification, false) or v_invoice.rectified_invoice_id is null then
      raise exception 'Una factura R1-R5 debe identificar la factura rectificada';
    end if;
    select * into v_rectified from public.invoices
      where id = v_invoice.rectified_invoice_id and deleted_at is null;
    if not found then raise exception 'Factura rectificada no encontrada'; end if;
    select * into v_rectified_ledger from public.verifactu_ledger
      where invoice_id = v_rectified.id and record_type = 'alta';
    if not found then raise exception 'La factura rectificada no tiene RegistroAlta'; end if;
    v_rectification_method := case when coalesce(v_invoice.rectification_type, '') in ('S', 'I')
      then v_invoice.rectification_type else 'I' end;
  end if;

  select * into v_client from public.clients where id = v_invoice.client_id;
  if not found then raise exception 'Cliente no encontrado'; end if;
  if v_invoice.invoice_type = 'F1' and (coalesce(trim(v_client.nif), '') = '' or coalesce(trim(v_client.name), '') = '') then
    raise exception 'Una factura F1 requiere NIF y razón social del destinatario';
  end if;

  select jsonb_agg(jsonb_build_object('rate', vat_rate, 'base', base, 'tax', round(base * vat_rate / 100, 2)) order by vat_rate),
         left(coalesce(string_agg(description, ', ' order by position), 'Prestación de servicios profesionales'), 250)
    into v_vat_lines, v_description
    from (select vat_rate, round(sum(subtotal), 2) as base, min(position) as position,
                 string_agg(description, ', ' order by position) as description
            from public.invoice_items where invoice_id = v_invoice.id group by vat_rate) vat;
  if v_vat_lines is null then raise exception 'La factura debe tener al menos una línea'; end if;

  select * into v_previous from public.verifactu_ledger
    where issuer_nif = v_nif order by chain_sequence desc limit 1;
  perform set_config('TimeZone', 'Europe/Madrid', true);
  v_generated_at_local := to_char(v_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM');
  v_hash_payload := concat(
    'IDEmisorFactura=', v_nif, '&NumSerieFactura=', trim(v_invoice.full_number),
    '&FechaExpedicionFactura=', to_char(v_invoice.issue_date, 'DD-MM-YYYY'),
    '&TipoFactura=', trim(v_invoice.invoice_type::text),
    '&CuotaTotal=', replace(to_char(round(v_invoice.tax_amount, 2), 'FM9999999990.00'), ',', '.'),
    '&ImporteTotal=', replace(to_char(round(v_invoice.total, 2), 'FM9999999990.00'), ',', '.'),
    '&Huella=', coalesce(v_previous.current_hash, ''), '&FechaHoraHusoGenRegistro=', v_generated_at_local);
  v_hash := upper(encode(digest(convert_to(v_hash_payload, 'UTF8'), 'sha256'), 'hex'));

  update public.invoices set status = 'issued', issued_at = v_generated_at,
    client_nif = v_client.nif, client_name = v_client.name,
    client_address_street = v_client.billing_address_street, client_address_zip = v_client.billing_address_zip,
    client_address_city = v_client.billing_address_city, client_address_province = v_client.billing_address_province,
    client_address_country = v_client.billing_address_country,
    idfact = concat(v_nif, '-', v_invoice.full_number, '-', to_char(v_invoice.issue_date, 'YYYYMMDD')),
    previous_hash = v_previous.current_hash, current_hash = v_hash,
    chain_sequence = coalesce(v_previous.chain_sequence, 0) + 1, hash_generated_at = v_generated_at,
    verifactu_status = 'submitted', verifactu_submitted_at = v_generated_at, verifactu_error = null
    where id = v_invoice.id;

  insert into public.verifactu_ledger (
    invoice_id, record_type, issuer_nif, chain_sequence, invoice_number, invoice_issue_date, invoice_type,
    tax_amount, total, previous_ledger_id, previous_hash, current_hash, generated_at, generated_at_local,
    record_payload, created_by
  ) values (
    v_invoice.id, 'alta', v_nif, coalesce(v_previous.chain_sequence, 0) + 1, v_invoice.full_number,
    v_invoice.issue_date, v_invoice.invoice_type::text, v_invoice.tax_amount, v_invoice.total,
    v_previous.id, v_previous.current_hash, v_hash, v_generated_at, v_generated_at_local,
    jsonb_build_object(
      'recordType', 'alta', 'nif', v_nif, 'invoiceNumber', v_invoice.full_number,
      'invoiceType', v_invoice.invoice_type, 'issueDate', v_invoice.issue_date,
      'taxAmount', v_invoice.tax_amount, 'total', v_invoice.total, 'previousHash', v_previous.current_hash,
      'generatedAt', v_generated_at, 'emisorName', v_company_name, 'clientNif', v_client.nif,
      'clientName', v_client.name, 'descriptionOperacion', v_description, 'vatLines', v_vat_lines,
      'previousInvoiceNumber', v_previous.invoice_number, 'previousIssueDate', v_previous.invoice_issue_date,
      'externalReference', v_invoice.id::text,
      'operationDate', v_invoice.issue_date,
      'subsanacion', 'N', 'rechazoPrevio', 'N',
      'rectificationMethod', v_rectification_method,
      'rectifiedInvoiceNumber', case when v_rectified.id is null then null else v_rectified.full_number end,
      'rectifiedInvoiceIssueDate', case when v_rectified.id is null then null else v_rectified.issue_date end,
      'rectifiedInvoiceNif', case when v_rectified.id is null then null else v_nif end,
      'rectificationAmounts', case when v_rectified.id is null then null else
        jsonb_build_object('base', v_invoice.subtotal, 'tax', v_invoice.tax_amount) end,
      'software', p_software
    ), auth.uid()
  ) returning id into v_ledger_id;
  insert into public.verifactu_outbox (ledger_id) values (v_ledger_id) returning id into v_outbox_id;
  ledger_id := v_ledger_id; outbox_id := v_outbox_id; return next;
end;
$$;

create or replace function public.reserve_verifactu_submission_slot(p_issuer_nif text)
returns table (allowed boolean, next_allowed_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare v_control public.verifactu_submission_control%rowtype;
begin
  insert into public.verifactu_submission_control (issuer_nif) values (trim(p_issuer_nif)) on conflict do nothing;
  select * into v_control from public.verifactu_submission_control where issuer_nif = trim(p_issuer_nif) for update;
  next_allowed_at := coalesce(v_control.last_submission_at + make_interval(secs => v_control.wait_seconds), clock_timestamp());
  if v_control.last_submission_at is not null and next_allowed_at > clock_timestamp() then
    allowed := false; return next; return;
  end if;
  update public.verifactu_submission_control set last_submission_at = clock_timestamp(), updated_at = clock_timestamp()
    where issuer_nif = v_control.issuer_nif;
  allowed := true; next_allowed_at := clock_timestamp(); return next;
end;
$$;

create or replace function public.cancel_invoice_with_verifactu_outbox(
  p_invoice_id uuid,
  p_software jsonb
)
returns table (ledger_id uuid, outbox_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_nif text;
  v_company_name text;
  v_original public.verifactu_ledger%rowtype;
  v_previous public.verifactu_ledger%rowtype;
  v_generated_at timestamptz := clock_timestamp();
  v_generated_at_local text;
  v_hash_payload text;
  v_hash text;
  v_ledger_id uuid;
  v_outbox_id uuid;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para anular facturas';
  end if;
  if jsonb_typeof(p_software) <> 'object'
     or coalesce(nullif(trim(p_software->>'producerName'), ''), '') = ''
     or coalesce(nullif(trim(p_software->>'producerNif'), ''), '') = '' then
    raise exception 'Falta la identidad inmutable del productor o del SIF';
  end if;
  select trim(company_nif), coalesce(company_name, '') into v_nif, v_company_name
    from public.settings where id = 1;
  if coalesce(v_nif, '') = '' then raise exception 'Falta el NIF de la empresa en Ajustes'; end if;
  perform pg_advisory_xact_lock(hashtext('verifactu:' || v_nif)::bigint);
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or v_invoice.deleted_at is not null then raise exception 'Factura no encontrada'; end if;
  select * into v_original from public.verifactu_ledger where invoice_id = v_invoice.id and record_type = 'alta';
  if not found then raise exception 'La factura no tiene un RegistroAlta VERI*FACTU'; end if;
  if not exists (select 1 from public.verifactu_outbox o where o.ledger_id = v_original.id and o.state = 'accepted') then
    raise exception 'Solo se pueden anular registros aceptados por la AEAT';
  end if;
  select l.id, o.id into v_ledger_id, v_outbox_id from public.verifactu_ledger l
    join public.verifactu_outbox o on o.ledger_id = l.id
    where l.invoice_id = v_invoice.id and l.record_type = 'anulacion';
  if found then ledger_id := v_ledger_id; outbox_id := v_outbox_id; return next; return; end if;
  select * into v_previous from public.verifactu_ledger where issuer_nif = v_nif order by chain_sequence desc limit 1;
  perform set_config('TimeZone', 'Europe/Madrid', true);
  v_generated_at_local := to_char(v_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM');
  v_hash_payload := concat('IDEmisorFacturaAnulada=', v_nif,
    '&NumSerieFacturaAnulada=', trim(v_original.invoice_number),
    '&FechaExpedicionFacturaAnulada=', to_char(v_original.invoice_issue_date, 'DD-MM-YYYY'),
    '&Huella=', coalesce(v_previous.current_hash, ''), '&FechaHoraHusoGenRegistro=', v_generated_at_local);
  v_hash := upper(encode(digest(convert_to(v_hash_payload, 'UTF8'), 'sha256'), 'hex'));
  perform set_config('app.verifactu_cancellation', 'on', true);
  update public.invoices set status = 'cancelled' where id = v_invoice.id;
  insert into public.verifactu_ledger (
    invoice_id, record_type, issuer_nif, chain_sequence, invoice_number, invoice_issue_date,
    previous_ledger_id, previous_hash, current_hash, generated_at, generated_at_local, record_payload, created_by
  ) values (
    v_invoice.id, 'anulacion', v_nif, coalesce(v_previous.chain_sequence, 0) + 1,
    v_original.invoice_number, v_original.invoice_issue_date, v_previous.id, v_previous.current_hash,
    v_hash, v_generated_at, v_generated_at_local,
    jsonb_build_object('recordType', 'anulacion', 'nif', v_nif,
      'cancelledInvoiceNumber', v_original.invoice_number, 'cancelledInvoiceIssueDate', v_original.invoice_issue_date,
      'previousHash', v_previous.current_hash, 'generatedAt', v_generated_at, 'emisorName', v_company_name,
      'previousInvoiceNumber', v_previous.invoice_number, 'previousIssueDate', v_previous.invoice_issue_date,
      'sinRegistroPrevio', 'N', 'rechazoPrevio', 'N', 'software', p_software), auth.uid()
  ) returning id into v_ledger_id;
  insert into public.verifactu_outbox (ledger_id) values (v_ledger_id) returning id into v_outbox_id;
  ledger_id := v_ledger_id; outbox_id := v_outbox_id; return next;
end;
$$;

create or replace function public.defer_verifactu_outbox(
  p_outbox_id uuid, p_worker_id text, p_next_attempt_at timestamptz
) returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.verifactu_outbox set state = 'retryable_error', next_attempt_at = greatest(p_next_attempt_at, clock_timestamp()),
    locked_at = null, locked_by = null, last_error = 'En espera del control de flujo de AEAT'
    where id = p_outbox_id and state = 'processing' and locked_by = p_worker_id;
  return found;
end;
$$;

create or replace function public.complete_verifactu_outbox_v2(
  p_outbox_id uuid, p_worker_id text, p_result text, p_csv text default null, p_aeat_code text default null,
  p_response jsonb default null, p_error text default null, p_retryable boolean default false,
  p_wait_seconds integer default null
) returns boolean language plpgsql security definer set search_path = public
as $$
declare v_ledger public.verifactu_ledger%rowtype; v_attempt_count integer;
begin
  if p_result not in ('accepted', 'rejected', 'error') then raise exception 'Resultado de outbox no válido'; end if;
  select l.* into v_ledger from public.verifactu_outbox o join public.verifactu_ledger l on l.id = o.ledger_id
    where o.id = p_outbox_id and o.state = 'processing' and o.locked_by = p_worker_id for update of o;
  if not found then return false; end if;
  select attempt_count into v_attempt_count from public.verifactu_outbox where id = p_outbox_id;
  update public.verifactu_outbox set
    state = case when p_result = 'accepted' then 'accepted' when p_result = 'rejected' then 'rejected'
                 when p_retryable then 'retryable_error' else 'terminal_error' end,
    incidence = incidence or (p_result = 'error' and p_retryable),
    accepted_at = case when p_result = 'accepted' then clock_timestamp() else null end,
    aeat_csv = p_csv, aeat_code = p_aeat_code, response = p_response,
    last_error = case when p_result = 'accepted' then null else left(coalesce(p_error, 'Error de envío a AEAT'), 2000) end,
    next_attempt_at = case when p_result = 'error' and p_retryable then clock_timestamp() + make_interval(mins => least(360, power(2, least(v_attempt_count, 8))::integer)) else next_attempt_at end,
    locked_at = null, locked_by = null
    where id = p_outbox_id;
  if p_wait_seconds between 0 and 86400 then
    insert into public.verifactu_submission_control (issuer_nif, wait_seconds) values (v_ledger.issuer_nif, p_wait_seconds)
    on conflict (issuer_nif) do update set wait_seconds = excluded.wait_seconds, updated_at = clock_timestamp();
  end if;
  if v_ledger.record_type = 'alta' then
    update public.invoices set verifactu_status = case when p_result = 'accepted' then 'accepted'::verifactu_status
      when p_result = 'rejected' then 'rejected'::verifactu_status else 'error'::verifactu_status end,
      verifactu_csv = p_csv, verifactu_response = p_response,
      verifactu_error = case when p_result = 'accepted' then null else left(coalesce(p_error, 'Error de envío a AEAT'), 2000) end
      where id = v_ledger.invoice_id;
  end if;
  return true;
end;
$$;

-- Preserve chain order even when issuance is faster than AEAT delivery. A later
-- RegistroFactura cannot be submitted until the record it references has been
-- accepted. This applies to immediate delivery as well as the scheduled worker.
create or replace function public.claim_verifactu_outbox(
  p_outbox_id uuid,
  p_worker_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_ledger_id uuid;
begin
  update public.verifactu_outbox o
     set state = 'processing',
         locked_at = clock_timestamp(),
         locked_by = p_worker_id,
         last_attempt_at = clock_timestamp(),
         attempt_count = attempt_count + 1
   where o.id = p_outbox_id
     and o.state in ('queued', 'retryable_error')
     and o.next_attempt_at <= clock_timestamp()
     and not exists (
       select 1
         from public.verifactu_ledger l
         left join public.verifactu_outbox previous_outbox on previous_outbox.ledger_id = l.previous_ledger_id
        where l.id = o.ledger_id
          and l.previous_ledger_id is not null
          and coalesce(previous_outbox.state, '') <> 'accepted'
     )
   returning o.ledger_id into v_ledger_id;
  return v_ledger_id;
end;
$$;

create or replace function public.claim_due_verifactu_outboxes(
  p_limit integer,
  p_worker_id text
)
returns table (outbox_id uuid, ledger_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A stale worker may have reached AEAT but failed before persisting the
  -- response. Its re-delivery is therefore an actual technical incident.
  update public.verifactu_outbox
     set state = 'retryable_error',
         incidence = true,
         next_attempt_at = clock_timestamp(),
         locked_at = null,
         locked_by = null,
         last_error = coalesce(last_error, 'El procesamiento anterior expiró')
   where state = 'processing'
     and locked_at < clock_timestamp() - interval '15 minutes';

  return query
  with due as (
    select o.id
      from public.verifactu_outbox o
     where o.state in ('queued', 'retryable_error')
       and o.next_attempt_at <= clock_timestamp()
       and not exists (
         select 1
           from public.verifactu_ledger l
           left join public.verifactu_outbox previous_outbox on previous_outbox.ledger_id = l.previous_ledger_id
          where l.id = o.ledger_id
            and l.previous_ledger_id is not null
            and coalesce(previous_outbox.state, '') <> 'accepted'
       )
     order by o.next_attempt_at, o.created_at
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 1), 50))
  ), claimed as (
    update public.verifactu_outbox o
       set state = 'processing',
           locked_at = clock_timestamp(),
           locked_by = p_worker_id,
           last_attempt_at = clock_timestamp(),
           attempt_count = o.attempt_count + 1
      from due
     where o.id = due.id
     returning o.id, o.ledger_id
  ) select id, ledger_id from claimed;
end;
$$;

revoke all on function public.issue_invoice_with_verifactu_outbox(uuid) from public, anon, authenticated;
revoke all on function public.issue_invoice_with_verifactu_outbox(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.issue_invoice_with_verifactu_outbox(uuid, jsonb) to authenticated;
revoke all on function public.cancel_invoice_with_verifactu_outbox(uuid) from public, anon, authenticated;
revoke all on function public.cancel_invoice_with_verifactu_outbox(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.cancel_invoice_with_verifactu_outbox(uuid, jsonb) to authenticated;
revoke all on function public.reserve_verifactu_submission_slot(text) from public, anon, authenticated;
grant execute on function public.reserve_verifactu_submission_slot(text) to service_role;
revoke all on function public.defer_verifactu_outbox(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.defer_verifactu_outbox(uuid, text, timestamptz) to service_role;
revoke all on function public.complete_verifactu_outbox_v2(uuid, text, text, text, text, jsonb, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.complete_verifactu_outbox_v2(uuid, text, text, text, text, jsonb, text, boolean, integer) to service_role;
notify pgrst, 'reload schema';
