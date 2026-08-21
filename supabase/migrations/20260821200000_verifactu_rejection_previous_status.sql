-- A recovery after an AEAT rejection must declare RechazoPrevio=S. X is only
-- valid when the original record never reached AEAT (local/transport failure).

do $$
declare
  v_definition text;
  v_old text := $old$'subsanacion', 'S', 'rechazoPrevio', 'X', 'software', p_software$old$;
  v_new text := $new$'subsanacion', 'S',
    'rechazoPrevio', case when v_original_outbox.aeat_code is null then 'X' else 'S' end,
    'software', p_software$new$;
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
  if position(v_old in v_definition) = 0 then
    raise exception 'No se encontró el bloque de RechazoPrevio esperado';
  end if;

  execute replace(v_definition, v_old, v_new);
end $$;