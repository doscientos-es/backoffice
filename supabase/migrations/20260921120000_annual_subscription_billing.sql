-- Link proposal maintenance to its recurring subscription and anchor annual
-- billing to 1 January. Existing subscriptions keep their current amount;
-- only their next annual invoice follows the new calendar anchor.
alter table public.subscriptions
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

create unique index if not exists subscriptions_proposal_unique_idx
  on public.subscriptions(proposal_id)
  where proposal_id is not null and deleted_at is null;

create or replace function public.generate_subscription_invoice(p_subscription_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_period_start date;
  v_next_month date;
  v_next_date date;
  v_months integer;
  v_last_day integer;
  v_year_start date;
  v_year_end date;
  v_days integer;
  v_year_days integer;
  v_prorated boolean := false;
  v_series text;
  v_number integer;
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_total numeric(12,2);
  v_invoice_id uuid;
  v_client public.clients%rowtype;
begin
  select *
    into v_subscription
    from public.subscriptions
   where id = p_subscription_id
     and deleted_at is null
   for update;

  if not found
     or v_subscription.status <> 'active'
     or v_subscription.next_invoice_date > current_date
     or (v_subscription.end_date is not null and v_subscription.next_invoice_date > v_subscription.end_date) then
    return null;
  end if;

  v_period_start := v_subscription.next_invoice_date;
  if v_subscription.billing_cycle = 'yearly'
     and (extract(month from v_period_start) <> 1 or extract(day from v_period_start) <> 1) then
    v_prorated := true;
    v_year_start := date_trunc('year', v_period_start)::date;
    v_year_end := (v_year_start + interval '1 year')::date;
    v_days := v_year_end - v_period_start;
    v_year_days := v_year_end - v_year_start;
  end if;

  select * into v_client from public.clients where id = v_subscription.client_id;
  select coalesce(nullif(trim(invoice_series), ''), 'A')
    into v_series
    from public.settings
   where id = 1;
  v_series := coalesce(v_series, 'A');

  v_number := public.next_invoice_number(v_series);
  v_subtotal := case
    when v_prorated then round(v_subscription.amount * v_days / v_year_days, 2)
    else round(v_subscription.amount, 2)
  end;
  v_tax_amount := round(v_subtotal * v_subscription.vat_rate / 100, 2);
  v_total := v_subtotal + v_tax_amount;

  insert into public.invoices (
    client_id, project_id, subscription_id, subscription_period_start,
    series, number, status, currency, subtotal, tax_amount, total,
    client_nif, client_name, client_address_street, client_address_zip,
    client_address_city, client_address_province, client_address_country, notes
  ) values (
    v_subscription.client_id, v_subscription.project_id, v_subscription.id,
    v_period_start, v_series, v_number, 'draft', v_subscription.currency,
    v_subtotal, v_tax_amount, v_total, v_client.nif, v_client.name,
    v_client.billing_address_street, v_client.billing_address_zip,
    v_client.billing_address_city, v_client.billing_address_province,
    v_client.billing_address_country,
    case when v_prorated then format(
      'Generada automáticamente para el periodo iniciado el %s. Primer periodo prorrateado hasta el 01/01 (%s días de %s).',
      to_char(v_period_start, 'DD/MM/YYYY'), v_days, v_year_days
    ) else format(
      'Generada automáticamente para el periodo iniciado el %s.',
      to_char(v_period_start, 'DD/MM/YYYY')
    ) end
  ) returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, position, description, quantity, unit_price, vat_rate
  ) values (
    v_invoice_id, 0, v_subscription.name, 1, v_subtotal, v_subscription.vat_rate
  );

  if v_subscription.billing_cycle = 'yearly' then
    v_next_date := date_trunc('year', v_period_start + interval '1 year')::date;
  else
    v_months := case v_subscription.billing_cycle
      when 'monthly' then 1
      when 'quarterly' then 3
      when 'yearly' then 12
    end;
    v_next_month := (date_trunc('month', v_period_start) + make_interval(months => v_months))::date;
    v_last_day := extract(day from (v_next_month + interval '1 month - 1 day'))::integer;
    v_next_date := v_next_month + least(extract(day from v_period_start)::integer, v_last_day) - 1;
  end if;

  update public.subscriptions
     set next_invoice_date = v_next_date,
         last_invoiced_at = current_date
   where id = v_subscription.id;

  return v_invoice_id;
end;
$$;

revoke all on function public.generate_subscription_invoice(uuid) from public, anon, authenticated;
grant execute on function public.generate_subscription_invoice(uuid) to service_role;