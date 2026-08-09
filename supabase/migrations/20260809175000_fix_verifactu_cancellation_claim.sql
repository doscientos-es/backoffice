-- The output parameter ledger_id shadows an unqualified outbox column in the
-- cancellation routine. Use an explicit table alias.
create or replace function public.cancel_invoice_with_verifactu_outbox(p_invoice_id uuid)
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

  select trim(company_nif), coalesce(company_name, '')
    into v_nif, v_company_name
    from public.settings where id = 1;
  if coalesce(v_nif, '') = '' then
    raise exception 'Falta el NIF de la empresa en Ajustes';
  end if;
  perform pg_advisory_xact_lock(hashtext('verifactu:' || v_nif)::bigint);

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or v_invoice.deleted_at is not null then
    raise exception 'Factura no encontrada';
  end if;

  select * into v_original from public.verifactu_ledger
   where invoice_id = v_invoice.id and record_type = 'alta';
  if not found then
    raise exception 'La factura no tiene un RegistroAlta VERI*FACTU';
  end if;
  if not exists (
    select 1 from public.verifactu_outbox o
     where o.ledger_id = v_original.id and o.state = 'accepted'
  ) then
    raise exception 'Solo se pueden anular registros aceptados por la AEAT';
  end if;

  select l.id, o.id into v_ledger_id, v_outbox_id
    from public.verifactu_ledger l
    join public.verifactu_outbox o on o.ledger_id = l.id
   where l.invoice_id = v_invoice.id and l.record_type = 'anulacion';
  if found then
    ledger_id := v_ledger_id;
    outbox_id := v_outbox_id;
    return next;
    return;
  end if;

  select * into v_previous from public.verifactu_ledger
   where issuer_nif = v_nif order by chain_sequence desc limit 1;
  perform set_config('TimeZone', 'Europe/Madrid', true);
  v_generated_at_local := to_char(v_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM');
  v_hash_payload := concat(
    'IDEmisorFacturaAnulada=', v_nif,
    '&NumSerieFacturaAnulada=', trim(v_original.invoice_number),
    '&FechaExpedicionFacturaAnulada=', to_char(v_original.invoice_issue_date, 'DD-MM-YYYY'),
    '&Huella=', coalesce(v_previous.current_hash, ''),
    '&FechaHoraHusoGenRegistro=', v_generated_at_local
  );
  v_hash := upper(encode(digest(convert_to(v_hash_payload, 'UTF8'), 'sha256'), 'hex'));

  perform set_config('app.verifactu_cancellation', 'on', true);
  update public.invoices set status = 'cancelled' where id = v_invoice.id;

  insert into public.verifactu_ledger (
    invoice_id, record_type, issuer_nif, chain_sequence, invoice_number,
    invoice_issue_date, previous_ledger_id, previous_hash, current_hash,
    generated_at, generated_at_local, record_payload, created_by
  ) values (
    v_invoice.id, 'anulacion', v_nif, coalesce(v_previous.chain_sequence, 0) + 1,
    v_original.invoice_number, v_original.invoice_issue_date, v_previous.id,
    v_previous.current_hash, v_hash, v_generated_at, v_generated_at_local,
    jsonb_build_object(
      'recordType', 'anulacion', 'nif', v_nif,
      'cancelledInvoiceNumber', v_original.invoice_number,
      'cancelledInvoiceIssueDate', v_original.invoice_issue_date,
      'previousHash', v_previous.current_hash, 'generatedAt', v_generated_at,
      'emisorName', v_company_name, 'previousInvoiceNumber', v_previous.invoice_number,
      'previousIssueDate', v_previous.invoice_issue_date,
      'sinRegistroPrevio', 'N', 'rechazoPrevio', 'N'
    ), auth.uid()
  ) returning id into v_ledger_id;

  insert into public.verifactu_outbox (ledger_id) values (v_ledger_id)
  returning id into v_outbox_id;
  ledger_id := v_ledger_id;
  outbox_id := v_outbox_id;
  return next;
end;
$$;

revoke all on function public.cancel_invoice_with_verifactu_outbox(uuid)
  from public, anon, authenticated;
grant execute on function public.cancel_invoice_with_verifactu_outbox(uuid)
  to authenticated;