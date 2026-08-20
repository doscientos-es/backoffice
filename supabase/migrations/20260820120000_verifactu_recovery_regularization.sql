-- Recovery for an alta that was never registered at AEAT.
--
-- The original ledger row is append-only.  We create a new alta-by-rejection
-- row instead, linked to the last local row, and send it with the current SIF
-- certificate.  This is intentionally an explicit recovery operation; normal
-- retries keep using the original immutable outbox row.

create or replace function public.regularize_verifactu_invoice(
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
  v_original public.verifactu_ledger%rowtype;
  v_original_outbox public.verifactu_outbox%rowtype;
  v_generated_at timestamptz := clock_timestamp();
  v_generated_at_local text;
  v_hash_payload text;
  v_hash text;
  v_vat_lines jsonb;
  v_description text;
  v_payload jsonb;
  v_ledger_id uuid;
  v_outbox_id uuid;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para regularizar facturas';
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

  select trim(company_nif), coalesce(company_name, '')
    into v_nif, v_company_name
    from public.settings where id = 1;
  if coalesce(v_nif, '') = '' then
    raise exception 'Falta el NIF de la empresa en Ajustes';
  end if;
  perform pg_advisory_xact_lock(hashtext('verifactu:' || v_nif)::bigint);

  select * into v_invoice
    from public.invoices
   where id = p_invoice_id and deleted_at is null
   for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_invoice.status = 'draft' then
    raise exception 'La factura aún está en borrador';
  end if;
  if v_invoice.verifactu_status = 'accepted' then
    raise exception 'La factura ya está aceptada por AEAT';
  end if;
  if v_invoice.verifactu_status = 'excluded' then
    raise exception 'Esta factura está excluida de VERI*FACTU';
  end if;

  -- If a local immutable row exists, only a rejected/terminal attempt may be
  -- regularized.  A queued/processing row still has a normal delivery path.
  select l.*
    into v_original
    from public.verifactu_ledger l
   where l.invoice_id = v_invoice.id and l.record_type = 'alta'
   order by l.chain_sequence desc, l.created_at desc
   limit 1;
  if found then
    select * into v_original_outbox
      from public.verifactu_outbox
     where ledger_id = v_original.id;
    if v_original_outbox.state not in ('rejected', 'terminal_error') then
      raise exception 'La factura no tiene un rechazo definitivo que regularizar';
    end if;
    v_previous := v_original;
    v_payload := v_original.record_payload;
  else
    -- Historical invoices predating the durable ledger have no previous local
    -- row of their own.  They are regularized from their immutable invoice
    -- data and chained to the last durable record of the issuer, if any.
    select * into v_client from public.clients where id = v_invoice.client_id;
    if not found then raise exception 'Cliente no encontrado'; end if;
    select * into v_previous
      from public.verifactu_ledger
     where issuer_nif = v_nif
     order by chain_sequence desc, created_at desc
     limit 1;
    select
      jsonb_agg(jsonb_build_object(
        'rate', vat_rate, 'base', base,
        'tax', round(base * vat_rate / 100, 2)
      ) order by vat_rate),
      left(coalesce(string_agg(description, ', ' order by position), 'Prestación de servicios profesionales'), 250)
      into v_vat_lines, v_description
      from (
        select vat_rate, round(sum(subtotal), 2) as base,
               min(position) as position,
               string_agg(description, ', ' order by position) as description
          from public.invoice_items
         where invoice_id = v_invoice.id
         group by vat_rate
      ) vat;
    if v_vat_lines is null then raise exception 'La factura debe tener al menos una línea'; end if;
    v_payload := jsonb_build_object(
      'recordType', 'alta', 'nif', v_nif,
      'invoiceNumber', v_invoice.full_number,
      'invoiceType', v_invoice.invoice_type,
      'issueDate', v_invoice.issue_date,
      'taxAmount', v_invoice.tax_amount, 'total', v_invoice.total,
      'emisorName', v_company_name, 'clientNif', v_client.nif,
      'clientName', v_client.name, 'descriptionOperacion', v_description,
      'vatLines', v_vat_lines, 'externalReference', v_invoice.id::text,
      'operationDate', v_invoice.issue_date, 'software', p_software
    );
  end if;

  perform set_config('TimeZone', 'Europe/Madrid', true);
  v_generated_at_local := to_char(v_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM');
  v_hash_payload := concat(
    'IDEmisorFactura=', v_nif,
    '&NumSerieFactura=', trim(v_invoice.full_number),
    '&FechaExpedicionFactura=', to_char(v_invoice.issue_date, 'DD-MM-YYYY'),
    '&TipoFactura=', trim(v_invoice.invoice_type::text),
    '&CuotaTotal=', replace(to_char(round(v_invoice.tax_amount, 2), 'FM9999999990.00'), ',', '.'),
    '&ImporteTotal=', replace(to_char(round(v_invoice.total, 2), 'FM9999999990.00'), ',', '.'),
    '&Huella=', coalesce(v_previous.current_hash, ''),
    '&FechaHoraHusoGenRegistro=', v_generated_at_local
  );
  v_hash := upper(encode(digest(convert_to(v_hash_payload, 'UTF8'), 'sha256'), 'hex'));
  v_payload := v_payload || jsonb_build_object(
    'nif', v_nif, 'invoiceNumber', v_invoice.full_number,
    'invoiceType', v_invoice.invoice_type, 'issueDate', v_invoice.issue_date,
    'taxAmount', v_invoice.tax_amount, 'total', v_invoice.total,
    'previousHash', v_previous.current_hash, 'generatedAt', v_generated_at,
    'emisorName', coalesce(v_payload->>'emisorName', v_company_name),
    'previousInvoiceNumber', v_previous.invoice_number,
    'previousIssueDate', v_previous.invoice_issue_date,
    'subsanacion', 'S', 'rechazoPrevio', 'X', 'software', p_software
  );

  insert into public.verifactu_ledger (
    invoice_id, record_type, issuer_nif, chain_sequence, invoice_number,
    invoice_issue_date, invoice_type, tax_amount, total, previous_ledger_id,
    previous_hash, current_hash, generated_at, generated_at_local,
    record_payload, created_by
  ) values (
    v_invoice.id, 'alta', v_nif, coalesce(v_previous.chain_sequence, 0) + 1,
    v_invoice.full_number, v_invoice.issue_date, v_invoice.invoice_type::text,
    v_invoice.tax_amount, v_invoice.total, v_previous.id, v_previous.current_hash,
    v_hash, v_generated_at, v_generated_at_local, v_payload, auth.uid()
  ) returning id into v_ledger_id;

  insert into public.verifactu_outbox (ledger_id)
  values (v_ledger_id)
  returning id into v_outbox_id;

  update public.invoices
     set verifactu_status = 'submitted',
         verifactu_submitted_at = v_generated_at,
         verifactu_error = null
   where id = v_invoice.id;

  ledger_id := v_ledger_id;
  outbox_id := v_outbox_id;
  return next;
end;
$$;

revoke all on function public.regularize_verifactu_invoice(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.regularize_verifactu_invoice(uuid, jsonb) to authenticated;

-- A normal subsequent invoice must wait for acceptance.  The only exception
-- is an explicit alta por rechazo, whose previous local attempt is known not
-- to exist at AEAT and is represented by RechazoPrevio=X.
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
     set state = 'processing', locked_at = clock_timestamp(), locked_by = p_worker_id,
         last_attempt_at = clock_timestamp(), attempt_count = attempt_count + 1
   where o.id = p_outbox_id
     and o.state in ('queued', 'retryable_error')
     and o.next_attempt_at <= clock_timestamp()
     and not exists (
       select 1
         from public.verifactu_ledger l
         left join public.verifactu_outbox previous_outbox
           on previous_outbox.ledger_id = l.previous_ledger_id
        where l.id = o.ledger_id
          and l.previous_ledger_id is not null
          and coalesce(previous_outbox.state, '') <> 'accepted'
          and not (
            l.record_payload->>'subsanacion' = 'S'
            and l.record_payload->>'rechazoPrevio' = 'X'
            and coalesce(previous_outbox.state, '') in ('rejected', 'terminal_error')
          )
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
  update public.verifactu_outbox
     set state = 'retryable_error', incidence = true, next_attempt_at = clock_timestamp(),
         locked_at = null, locked_by = null,
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
           left join public.verifactu_outbox previous_outbox
             on previous_outbox.ledger_id = l.previous_ledger_id
          where l.id = o.ledger_id
            and l.previous_ledger_id is not null
            and coalesce(previous_outbox.state, '') <> 'accepted'
            and not (
              l.record_payload->>'subsanacion' = 'S'
              and l.record_payload->>'rechazoPrevio' = 'X'
              and coalesce(previous_outbox.state, '') in ('rejected', 'terminal_error')
            )
       )
     order by o.next_attempt_at, o.created_at
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 1), 50))
  ), claimed as (
    update public.verifactu_outbox o
       set state = 'processing', locked_at = clock_timestamp(), locked_by = p_worker_id,
           last_attempt_at = clock_timestamp(), attempt_count = o.attempt_count + 1
      from due
     where o.id = due.id
     returning o.id, o.ledger_id
  ) select id, ledger_id from claimed;
end;
$$;

revoke all on function public.claim_verifactu_outbox(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_verifactu_outbox(uuid, text) to service_role;
revoke all on function public.claim_due_verifactu_outboxes(integer, text) from public, anon, authenticated;
grant execute on function public.claim_due_verifactu_outboxes(integer, text) to service_role;
notify pgrst, 'reload schema';
