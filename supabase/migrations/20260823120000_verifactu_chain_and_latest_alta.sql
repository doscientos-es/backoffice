-- A recovery is a newly generated fiscal record. It must chain to the absolute
-- latest issuer record, not to the rejected Alta it repairs. Also keep delivery
-- chronological without deadlocking all later records behind a definitive error.

do $migration$
declare
  v_definition text;
  v_old constant text := $old$v_previous := v_original;$old$;
  v_new constant text := $new$-- A recovery follows the global generation chain, regardless of invoice.
      select * into v_previous
        from public.verifactu_ledger
       where issuer_nif = v_nif
       order by chain_sequence desc, created_at desc
       limit 1;$new$;
begin
  select pg_get_functiondef(p.oid) into v_definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'regularize_verifactu_invoice'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';
  if v_definition is null then raise exception 'No existe regularize_verifactu_invoice'; end if;
  if position('A recovery follows the global generation chain' in v_definition) = 0 then
    if position(v_old in v_definition) = 0 then raise exception 'No se encontró el predecesor de la regularización'; end if;
    execute replace(v_definition, v_old, v_new);
  end if;
end;
$migration$;

do $migration$
declare
  v_name text;
  v_definition text;
  v_old constant text := $old$coalesce(previous_outbox.state, '') <> 'accepted'
          and not (
            l.record_payload->>'subsanacion' = 'S'
            and l.record_payload->>'rechazoPrevio' = 'X'
            and coalesce(previous_outbox.state, '') in ('rejected', 'terminal_error')
          )$old$;
  -- pg_get_functiondef preserves the deeper indentation used by the CTE in
  -- claim_due_verifactu_outboxes, so support both canonical renderings.
  v_old_deeper constant text := replace(v_old, E'\n          ', E'\n            ');
  v_new constant text := $new$coalesce(previous_outbox.state, '') not in ('accepted', 'rejected', 'terminal_error')$new$;
begin
  foreach v_name in array array['claim_verifactu_outbox', 'claim_due_verifactu_outboxes'] loop
    select pg_get_functiondef(p.oid) into v_definition
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_name;
    if v_definition is null then raise exception 'No existe la función %', v_name; end if;
    if position(v_new in v_definition) = 0 then
      if position(v_old in v_definition) > 0 then
        execute replace(v_definition, v_old, v_new);
      elsif position(v_old_deeper in v_definition) > 0 then
        execute replace(v_definition, v_old_deeper, v_new);
      else
        raise exception 'No se encontró el bloqueo anterior en %', v_name;
      end if;
    end if;
  end loop;
end;
$migration$;

-- Multiple immutable Altas may identify one invoice after a recovery. An
-- annulment must target the latest one that AEAT actually accepted.
do $migration$
declare
  v_definition text;
  v_old constant text := $old$select * into v_original from public.verifactu_ledger where invoice_id = v_invoice.id and record_type = 'alta';
  if not found then raise exception 'La factura no tiene un RegistroAlta VERI*FACTU'; end if;
  if not exists (select 1 from public.verifactu_outbox o where o.ledger_id = v_original.id and o.state = 'accepted') then
    raise exception 'Solo se pueden anular registros aceptados por la AEAT';
  end if;$old$;
  v_new constant text := $new$if not exists (select 1 from public.verifactu_ledger l where l.invoice_id = v_invoice.id and l.record_type = 'alta') then
    raise exception 'La factura no tiene un RegistroAlta VERI*FACTU';
  end if;
  select l.* into v_original from public.verifactu_ledger l
    join public.verifactu_outbox o on o.ledger_id = l.id and o.state = 'accepted'
    where l.invoice_id = v_invoice.id and l.record_type = 'alta'
    order by l.chain_sequence desc, l.created_at desc limit 1;
  if not found then raise exception 'Solo se pueden anular registros aceptados por la AEAT'; end if;$new$;
begin
  select pg_get_functiondef(p.oid) into v_definition
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'cancel_invoice_with_verifactu_outbox'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';
  if v_definition is null then raise exception 'No existe cancel_invoice_with_verifactu_outbox'; end if;
  if position('join public.verifactu_outbox o on o.ledger_id = l.id and o.state = ''accepted''' in v_definition) = 0 then
    if position(v_old in v_definition) = 0 then raise exception 'No se encontró la selección original del Alta'; end if;
    execute replace(v_definition, v_old, v_new);
  end if;
end;
$migration$;

notify pgrst, 'reload schema';
