-- AEAT "Alta por rechazo" is Subsanacion=S + RechazoPrevio=X: the
-- rejected RegistroAlta does not exist at AEAT. RechazoPrevio=S attempts to
-- update an existing record and produces 3002 for definitive rejections.

do $migration$
declare
  v_definition text;
  v_wrong constant text := $wrong$'rechazoPrevio', case when v_original_outbox.aeat_code is null then 'X' else 'S' end,$wrong$;
  v_right constant text := $right$'rechazoPrevio', 'X',$right$;
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
  if position(v_wrong in v_definition) > 0 then
    v_definition := replace(v_definition, v_wrong, v_right);
    execute v_definition;
  elsif position(v_right in v_definition) = 0 then
    raise exception 'No se encontró el marcador RechazoPrevio esperado';
  end if;
end;
$migration$;

do $migration$
declare
  v_name text;
  v_definition text;
  v_wrong constant text := $wrong$l.record_payload->>'rechazoPrevio' in ('S', 'X')$wrong$;
  v_right constant text := $right$l.record_payload->>'rechazoPrevio' = 'X'$right$;
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
    if position(v_wrong in v_definition) > 0 then
      execute replace(v_definition, v_wrong, v_right);
    elsif position(v_right in v_definition) = 0 then
      raise exception 'No se encontró el marcador RechazoPrevio en %', v_name;
    end if;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';