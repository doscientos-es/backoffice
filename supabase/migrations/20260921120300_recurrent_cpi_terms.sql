-- CPI updates apply to every recurring cadence; only annual billing is
-- anchored to 1 January and prorated until that date.
do $$
declare
  current_default text;
begin
  select pg_get_expr(adbin, adrelid)
    into current_default
    from pg_attrdef d
    join pg_class c on c.oid = d.adrelid
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
   where c.relname = 'proposals'
     and a.attname = 'legal_terms';

  if current_default is null
     or position('Las cuotas anuales se actualizarán cada 1 de enero' in current_default) = 0 then
    raise exception 'Unexpected proposals.legal_terms default while applying recurrent CPI terms';
  end if;

  current_default := replace(
    current_default,
    'Las cuotas anuales se actualizarán cada 1 de enero',
    'Todas las cuotas recurrentes, incluidas las mensuales y trimestrales, se actualizarán cada 1 de enero'
  );

  execute format(
    'alter table public.proposals alter column legal_terms set default %s',
    current_default
  );
end;
$$;