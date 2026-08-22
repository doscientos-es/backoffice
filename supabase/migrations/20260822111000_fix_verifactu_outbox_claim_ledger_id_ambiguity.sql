-- The RETURNS TABLE ledger_id output is visible to PL/pgSQL. Qualify the CTE
-- columns returned by the scheduled outbox worker to avoid an ambiguous name.

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
     and p.proname = 'claim_due_verifactu_outboxes'
     and pg_get_function_identity_arguments(p.oid) = 'p_limit integer, p_worker_id text';

  if v_definition is null then
    raise exception 'No existe claim_due_verifactu_outboxes';
  end if;

  v_original_definition := v_definition;
  v_definition := replace(
    v_definition,
    $old$) select id, ledger_id from claimed;$old$,
    $new$) select claimed.id, claimed.ledger_id from claimed;$new$
  );

  if v_definition = v_original_definition then
    raise exception 'No se encontró el retorno ledger_id del procesador de cola';
  end if;

  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';