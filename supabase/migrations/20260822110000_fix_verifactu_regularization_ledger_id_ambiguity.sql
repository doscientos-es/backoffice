-- The RETURNS TABLE output parameter ledger_id is visible as a PL/pgSQL
-- variable. Qualify the outbox column so regularizations can read the
-- rejected original record without ambiguity.

do $migration$
declare
  v_definition text;
  v_original_definition text;
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

  v_original_definition := v_definition;
  v_definition := replace(
    v_definition,
    $old$where ledger_id = v_original.id;$old$,
    $new$where verifactu_outbox.ledger_id = v_original.id;$new$
  );

  if v_definition = v_original_definition then
    raise exception 'No se encontró la referencia ledger_id de la regularización';
  end if;

  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';