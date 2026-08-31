-- Keep synthetic VERI*FACTU diagnostics as an operational test, not an
-- emission prerequisite. Client census confirmations remain valid until the
-- recipient identity changes.

alter table public.verifactu_diagnostic_runs
  alter column expires_at drop not null;

drop trigger if exists trg_verifactu_invoice_requires_diagnostic on public.invoices;
drop function if exists public.fn_verifactu_invoice_requires_diagnostic();
drop function if exists public.assert_verifactu_diagnostic_gate();

do $migration$
declare
  v_definition text;
  v_freshness constant text := $freshness$       or v_client.fiscal_verified_at < clock_timestamp() - interval '24 hours'
$freshness$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'issue_invoice_with_verifactu_outbox'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';

  if v_definition is null then raise exception 'No existe issue_invoice_with_verifactu_outbox'; end if;
  if position(v_freshness in v_definition) = 0 then
    raise exception 'No se encontró la caducidad AEAT esperada en la emisión';
  end if;
  v_definition := replace(v_definition, v_freshness, '');
  v_definition := replace(
    v_definition,
    'validarse con AEAT en las últimas 24 horas antes de emitir una factura F1',
    'validarse con AEAT antes de emitir una factura F1'
  );
  execute v_definition;
end;
$migration$;

do $migration$
declare
  v_definition text;
  v_freshness constant text := $freshness$       or v_client.fiscal_verified_at < clock_timestamp() - interval '24 hours'
$freshness$;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'regularize_verifactu_invoice'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';

  if v_definition is null then raise exception 'No existe regularize_verifactu_invoice'; end if;
  if position(v_freshness in v_definition) = 0 then
    raise exception 'No se encontró la caducidad AEAT esperada en la regularización';
  end if;
  v_definition := replace(v_definition, v_freshness, '');
  v_definition := replace(
    v_definition,
    'validarse con AEAT en las últimas 24 horas antes de regularizar una factura F1',
    'validarse con AEAT antes de regularizar una factura F1'
  );
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';