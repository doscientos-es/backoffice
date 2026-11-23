-- Accept a documented referral discount without recording a fictitious card
-- payment for an invoice fully covered by the discount. Legacy events remain valid.
create or replace function public.issue_abaco_subscription_invoice(p_event jsonb, p_software jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  request public.abaco_subscription_invoice_requests%rowtype;
  account jsonb;
  invoice_id uuid;
  tenant uuid := (p_event->>'tenantId')::uuid;
  payment uuid := (p_event->>'paymentId')::uuid;
  v_paid_at timestamptz := (p_event->>'paidAt')::timestamptz;
  base numeric := (p_event->>'netCents')::numeric / 100;
  v_total numeric := (p_event->>'totalCents')::numeric / 100;
  vat numeric := (p_event->>'vatPercent')::numeric;
  original_base numeric;
  discount numeric;
  series text;
  concept text;
begin
  if payment is null or tenant is null or v_paid_at is null or v_paid_at > now()
     or base is null or base < 0 or vat is distinct from 21
     or v_total is distinct from base + round(base * vat / 100, 2) then
    raise exception 'El cobro no coincide con el desglose fiscal soportado' using errcode = '22023';
  end if;
  if p_event ? 'referralDiscount' then
    original_base := (p_event->'referralDiscount'->>'originalNetCents')::numeric / 100;
    discount := (p_event->'referralDiscount'->>'discountCents')::numeric / 100;
    if original_base is null or original_base <= base or discount is null or discount <= 0
       or discount is distinct from original_base + round(original_base * vat / 100, 2) - v_total then
      raise exception 'Descuento de referidos no válido' using errcode = '22023';
    end if;
  elsif base = 0 then
    raise exception 'Una factura gratuita requiere un descuento justificado' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('abaco-payment:' || payment, 0));
  select * into request from public.abaco_subscription_invoice_requests r where r.payment_id = payment;
  if found then
    if request.payload is distinct from p_event then raise exception 'El pago ya existe con otros datos' using errcode = '23505'; end if;
    return request.invoice_id;
  end if;
  account := public.prepare_abaco_billing_account(tenant, p_event->'recipient');
  if account->>'status' <> 'ready' then raise exception 'Destinatario no preparado para facturar' using errcode = 'P0001'; end if;
  select nullif(btrim(invoice_series), '') into series from public.settings where id = 1;
  if series is null then raise exception 'Doscientos no tiene una serie de facturación configurada'; end if;
  concept := concat('Suscripción Ábaco · ', p_event->>'plan', ' · ',
    left(p_event->>'startsAt', 10), ' a ', left(p_event->>'endsAt', 10));
  if discount is not null then
    concept := concat(concept, ' · Descuento por referidos: ', discount, ' EUR IVA incluido; base original: ', original_base, ' EUR');
  end if;
  insert into public.invoices (client_id, billing_source, series, subtotal, tax_amount, total,
    issue_date, due_date, operation_date, is_client_visible)
  values ((account->>'clientId')::uuid, 'abaco_subscription', series, base, v_total - base, v_total,
    (now() at time zone 'Europe/Madrid')::date, (v_paid_at at time zone 'Europe/Madrid')::date,
    (v_paid_at at time zone 'Europe/Madrid')::date, true) returning id into invoice_id;
  insert into public.invoice_items(invoice_id, description, quantity, unit_price, vat_rate)
    values (invoice_id, concept, 1, base, vat);
  insert into public.abaco_subscription_invoice_requests(payment_id, tenant_id, merchant_order, payload, invoice_id)
    values (payment, tenant, p_event->>'order', p_event, invoice_id);
  perform set_config('app.abaco_invoice_issuance', invoice_id::text, true);
  perform public.issue_invoice_with_number_and_verifactu_outbox(invoice_id, p_software);
  if v_total > 0 then
    insert into public.invoice_payments(invoice_id, amount, status, payment_method, confirmed_at)
      values (invoice_id, v_total, 'confirmed', 'card', v_paid_at);
  end if;
  update public.invoices set status = 'paid', paid_at = v_paid_at,
    payment_method = case when v_total > 0 then 'card' else null end where id = invoice_id;
  return invoice_id;
end;
$$;
