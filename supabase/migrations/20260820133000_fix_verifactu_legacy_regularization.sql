-- Legacy durable rows contain only a marker and cannot be replayed as XML.
-- Make the recovery function rebuild the fiscal payload from the immutable
-- invoice and its line items when the previous payload is legacy-shaped.

do $$
declare
  v_definition text;
  v_replacement text := $replacement$
  if found then
      select * into v_original_outbox
        from public.verifactu_outbox
       where ledger_id = v_original.id;
      if v_original_outbox.state not in ('rejected', 'terminal_error') then
        raise exception 'La factura no tiene un rechazo definitivo que regularizar';
      end if;
      v_previous := v_original;
      select * into v_client from public.clients where id = v_invoice.client_id;
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
    else
  $replacement$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'regularize_verifactu_invoice'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';
  if v_definition is null then raise exception 'No existe regularize_verifactu_invoice'; end if;
  v_definition := replace(
    v_definition,
    $old$  if found then
    select * into v_original_outbox
      from public.verifactu_outbox
     where ledger_id = v_original.id;
    if v_original_outbox.state not in ('rejected', 'terminal_error') then
      raise exception 'La factura no tiene un rechazo definitivo que regularizar';
    end if;
    v_previous := v_original;
    v_payload := v_original.record_payload;
  else$old$,
    v_replacement
  );
  if v_definition = pg_get_functiondef((select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='regularize_verifactu_invoice' and pg_get_function_identity_arguments(p.oid)='p_invoice_id uuid, p_software jsonb')) then
    raise exception 'No se encontró el bloque legacy de regularización';
  end if;
  execute v_definition;
end $$;
