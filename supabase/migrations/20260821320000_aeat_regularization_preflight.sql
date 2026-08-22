-- A rejected RegistroAlta remains immutable. When regularizing an F1, the new
-- append-only RegistroAlta must use the currently AEAT-verified recipient.

do $migration$
declare v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'regularize_verifactu_invoice'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';
  if v_definition is null then raise exception 'No existe regularize_verifactu_invoice'; end if;

  v_definition := replace(v_definition,
    $old$select * into v_client from public.clients where id = v_invoice.client_id;
    if not found then raise exception 'Cliente no encontrado'; end if;$old$,
    $new$select * into v_client from public.clients where id = v_invoice.client_id;
    if not found then raise exception 'Cliente no encontrado'; end if;
    if v_invoice.invoice_type = 'F1' then
      if upper(coalesce(trim(v_client.billing_address_country), 'ES')) <> 'ES' then
        raise exception 'Las facturas F1 para destinatarios extranjeros requieren soporte de identificación extranjera antes de regularizarse';
      end if;
      if coalesce(trim(v_client.nif), '') = '' or coalesce(trim(v_client.name), '') = '' then
        raise exception 'Una factura F1 requiere NIF y razón social del destinatario';
      end if;
      if v_client.fiscal_verification_status <> 'verified'
         or v_client.fiscal_verified_at is null
         or v_client.fiscal_verified_at < clock_timestamp() - interval '24 hours'
         or v_client.fiscal_verified_nif is distinct from regexp_replace(upper(regexp_replace(trim(v_client.nif), '[[:space:].-]', '', 'g')), '^ES', '')
         or v_client.fiscal_verified_name is distinct from trim(v_client.name) then
        raise exception 'El NIF y la razón social del destinatario deben validarse con AEAT en las últimas 24 horas antes de regularizar una factura F1';
      end if;
    end if;$new$);
  if position('antes de regularizar una factura F1' in v_definition) = 0 then
    raise exception 'No se encontró el cliente de la regularización';
  end if;

  v_definition := replace(v_definition,
    $old$'taxAmount', v_invoice.tax_amount, 'total', v_invoice.total,
    'previousHash'$old$,
    $new$'taxAmount', v_invoice.tax_amount, 'total', v_invoice.total,
    'clientNif', regexp_replace(upper(regexp_replace(trim(v_client.nif), '[[:space:].-]', '', 'g')), '^ES', ''),
    'clientName', trim(v_client.name),
    'previousHash'$new$);
  if position($needle$'clientNif', regexp_replace(upper(regexp_replace(trim(v_client.nif), '[[:space:].-]', '', 'g')), '^ES', '')$needle$ in v_definition) = 0 then
    raise exception 'No se encontró el payload de la regularización';
  end if;
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';