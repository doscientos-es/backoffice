-- A subsanacion may follow either a definitive AEAT rejection (RechazoPrevio=S)
-- or a local/transport failure with no AEAT response (RechazoPrevio=X). The
-- previous claim predicate only allowed X, deadlocking valid S recoveries.

do $migration$
declare
  v_name text;
  v_definition text;
  v_old constant text := $old$l.record_payload->>'rechazoPrevio' = 'X'$old$;
  v_new constant text := $new$l.record_payload->>'rechazoPrevio' in ('S', 'X')$new$;
begin
  foreach v_name in array array['claim_verifactu_outbox', 'claim_due_verifactu_outboxes'] loop
    select pg_get_functiondef(p.oid)
      into v_definition
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_name;

    if v_definition is null then
      raise exception 'No existe la función %', v_name;
    end if;
    if position(v_new in v_definition) > 0 then
      continue;
    end if;
    if position(v_old in v_definition) = 0 then
      raise exception 'No se encontró el bloqueo de RechazoPrevio en %', v_name;
    end if;

    execute replace(v_definition, v_old, v_new);
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';