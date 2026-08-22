-- Apply the AEAT recipient preflight to every regularization path. The prior
-- patch only inserted it in the legacy branch, leaving normal rejected ledger
-- rows able to produce another 1239 with stale or unverified client data.

do $migration$
declare
  v_definition text;
  v_anchor constant text := $anchor$  end if;

  perform set_config('TimeZone', 'Europe/Madrid', true);$anchor$;
  v_replacement constant text := $replacement$  end if;

  -- Common preflight for every regularization path.
  if v_client.id is null then
    raise exception 'Cliente no encontrado';
  end if;
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
  end if;

  perform set_config('TimeZone', 'Europe/Madrid', true);$replacement$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'regularize_verifactu_invoice'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';

  if v_definition is null then
    raise exception 'No existe regularize_verifactu_invoice';
  end if;
  if position('Common preflight for every regularization path' in v_definition) > 0 then
    return;
  end if;
  if position(v_anchor in v_definition) = 0 then
    raise exception 'No se encontró el punto común de prevalidación';
  end if;

  execute replace(v_definition, v_anchor, v_replacement);
end;
$migration$;

notify pgrst, 'reload schema';