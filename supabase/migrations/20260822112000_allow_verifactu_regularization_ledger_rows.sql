-- A rejected RegistroAlta remains immutable. Its replacement is an append-only
-- alta de subsanación for the same invoice, so the original global uniqueness
-- must apply only to records that are not subsanaciones.

do $migration$
declare
  v_constraint_definition text;
begin
  select pg_get_constraintdef(c.oid)
    into v_constraint_definition
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'verifactu_ledger'
     and c.conname = 'verifactu_ledger_invoice_id_record_type_key';

  if v_constraint_definition is distinct from 'UNIQUE (invoice_id, record_type)' then
    raise exception 'La unicidad original de verifactu_ledger no coincide con el esquema esperado';
  end if;

  alter table public.verifactu_ledger
    drop constraint verifactu_ledger_invoice_id_record_type_key;
end;
$migration$;

create unique index verifactu_ledger_original_invoice_record_type_key
  on public.verifactu_ledger (invoice_id, record_type)
  where (record_payload->>'subsanacion') is distinct from 'S';

notify pgrst, 'reload schema';