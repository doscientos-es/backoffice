-- New Menoslios subscriptions and upgrades share their own sequence. Preserve
-- legacy numbers, fiscal records, and payment-id idempotency across the cutoff.
do $migration$
declare
  definition text := pg_get_functiondef('public.issue_abaco_subscription_invoice(jsonb,jsonb)'::regprocedure);
  old_series constant text := $old$  select nullif(btrim(invoice_series), '') into series from public.settings where id = 1;
  if series is null then raise exception 'Doscientos no tiene una serie de facturación configurada'; end if;$old$;
  new_series constant text := $new$  series := 'ML-SUS';$new$;
begin
  if position(old_series in definition) = 0 then
    raise exception 'No coincide la función de emisión esperada';
  end if;
  if exists(select 1 from public.invoices where upper(btrim(series)) = 'ML-SUS') then
    raise exception 'La serie ML-SUS ya está en uso';
  end if;
  execute replace(definition, old_series, new_series);
end;
$migration$;

alter table public.settings
  add constraint settings_non_menoslios_invoice_series
  check (upper(btrim(invoice_series)) <> 'ML-SUS');

create function public.guard_menoslios_invoice_series() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.series is not distinct from old.series
      and new.billing_source is not distinct from old.billing_source then
      return new;
    end if;
  end if;
  if upper(btrim(new.series)) = 'ML-SUS'
    and (new.series <> 'ML-SUS' or new.billing_source is distinct from 'abaco_subscription') then
    raise exception 'La serie ML-SUS está reservada a las suscripciones de Menoslios'
      using errcode = '23514';
  end if;
  if new.billing_source = 'abaco_subscription' and new.series is distinct from 'ML-SUS' then
    raise exception 'Las facturas de suscripción de Menoslios deben usar la serie ML-SUS'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_menoslios_invoice_series() from public, anon, authenticated;

create trigger guard_menoslios_invoice_series
before insert or update of series, billing_source on public.invoices
for each row execute function public.guard_menoslios_invoice_series();

notify pgrst, 'reload schema';
