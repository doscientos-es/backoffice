-- A tenant can share a single fiscal client with other Doscientos services.
create table public.abaco_billing_accounts (
  tenant_id uuid primary key,
  client_id uuid not null references public.clients(id),
  created_at timestamptz not null default now()
);

create table public.abaco_subscription_invoice_requests (
  payment_id uuid primary key,
  tenant_id uuid not null references public.abaco_billing_accounts(tenant_id),
  payload jsonb not null,
  invoice_id uuid unique references public.invoices(id),
  email_first_attempt_at timestamptz,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.abaco_billing_accounts enable row level security;
alter table public.abaco_subscription_invoice_requests enable row level security;
revoke all on public.abaco_billing_accounts, public.abaco_subscription_invoice_requests
  from public, anon, authenticated;

create function public.prepare_abaco_billing_account(p_tenant uuid, p_recipient jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  client public.clients%rowtype;
  matches uuid[];
  tax_id text := p_recipient->>'tax_id';
begin
  if p_tenant is null or coalesce(tax_id, '') !~ '^[A-Z0-9]{9}$' then
    raise exception 'Identidad fiscal no válida' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('abaco-account:' || p_tenant, 0));
  perform pg_advisory_xact_lock(hashtextextended('abaco-tax-id:' || tax_id, 0));
  select c.* into client from public.abaco_billing_accounts a
    join public.clients c on c.id = a.client_id where a.tenant_id = p_tenant for update of c;
  if not found then
    select array_agg(c.id) into matches from public.clients c where c.deleted_at is null
      and regexp_replace(regexp_replace(upper(c.nif), '[^A-Z0-9]', '', 'g'), '^ES([A-Z0-9]{9})$', '\1') = tax_id;
    if cardinality(matches) > 1 then return jsonb_build_object('status', 'ambiguous_client'); end if;
    if cardinality(matches) = 1 then
      select * into strict client from public.clients where id = matches[1] for update;
    else
      insert into public.clients (name, nif, email, billing_address_street, billing_address_zip,
        billing_address_city, billing_address_province, billing_address_country)
      values (p_recipient->>'legal_name', tax_id, p_recipient->>'email', p_recipient->>'street',
        p_recipient->>'postal_code', p_recipient->>'city', p_recipient->>'province', 'ES')
      returning * into client;
    end if;
  end if;
  if client.deleted_at is not null
    or (client.nif, client.name, client.billing_address_street, client.billing_address_zip,
        client.billing_address_city, client.billing_address_province, client.billing_address_country)
       is distinct from (tax_id, p_recipient->>'legal_name', p_recipient->>'street', p_recipient->>'postal_code',
        p_recipient->>'city', p_recipient->>'province', 'ES') then
    return jsonb_build_object('status', 'recipient_mismatch', 'clientId', client.id);
  end if;
  insert into public.abaco_billing_accounts(tenant_id, client_id) values (p_tenant, client.id)
    on conflict (tenant_id) do nothing;
  if client.fiscal_verification_status is distinct from 'verified'
    or client.fiscal_verified_at is null
    or client.fiscal_verified_nif is distinct from tax_id
    or client.fiscal_verified_name is distinct from client.name then
    return jsonb_build_object('status', 'fiscal_verification_required', 'clientId', client.id);
  end if;
  return jsonb_build_object('status', 'ready', 'clientId', client.id);
end;
$$;

alter table public.client_fiscal_verifications alter column checked_by drop not null;
alter table public.client_fiscal_verifications add column source text not null default 'manual'
  check ((source = 'manual' and checked_by is not null) or (source = 'abaco' and checked_by is null));

-- Same evidence as a manual check, but explicitly attribute it to the integration.
create function public.record_abaco_client_fiscal_verification(
  p_client_id uuid, p_submitted_nif text, p_submitted_name text, p_status text,
  p_aeat_name text, p_aeat_result text, p_detail text
) returns void language plpgsql security definer set search_path = '' as $$
declare client public.clients%rowtype;
begin
  select c.* into strict client from public.clients c where c.id = p_client_id and c.deleted_at is null
    and exists (select 1 from public.abaco_billing_accounts a where a.client_id = c.id) for update;
  if (client.nif, client.name, client.billing_address_country)
      is distinct from (p_submitted_nif, p_submitted_name, 'ES') then
    raise exception 'La identidad fiscal de Ábaco ha cambiado';
  end if;
  if client.fiscal_verification_status = 'verified' then return; end if;
  perform set_config('app.aeat_validation', 'on', true);
  update public.clients set fiscal_verification_status = p_status,
    fiscal_verified_nif = case when p_status = 'verified' then p_submitted_nif end,
    fiscal_verified_name = case when p_status = 'verified' then p_submitted_name end,
    fiscal_verified_at = clock_timestamp() where id = p_client_id;
  insert into public.client_fiscal_verifications (client_id, submitted_nif, submitted_name, status, aeat_name, aeat_result, detail, source)
    values (p_client_id, p_submitted_nif, p_submitted_name, p_status, p_aeat_name, p_aeat_result, left(coalesce(p_detail, ''), 500), 'abaco');
end;
$$;
revoke all on function public.record_abaco_client_fiscal_verification(uuid,text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.record_abaco_client_fiscal_verification(uuid,text,text,text,text,text,text) to service_role;

-- Keep the existing numbering lock, fiscal preflight, chain and outbox. The only
-- additional principal is the backend processing an invoice linked to a durable Ábaco event.
create function public.can_issue_abaco_subscription_invoice(p_invoice uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.role() = 'service_role', false) and exists (
    select 1 from public.abaco_subscription_invoice_requests r join public.invoices i on i.id = r.invoice_id
    where i.id = p_invoice and i.billing_source = 'abaco_subscription'
  );
$$;

do $migration$
declare target regprocedure; definition text;
  existing constant text := $guard$if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then$guard$;
  replacement constant text := $guard$if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin')
    and not public.can_issue_abaco_subscription_invoice(p_invoice_id) then$guard$;
begin
  foreach target in array array[
    'public.issue_invoice_with_number_and_verifactu_outbox(uuid,jsonb)'::regprocedure,
    'public.issue_invoice_with_verifactu_outbox_base(uuid,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if position(existing in definition) = 0 then
      raise exception 'No se encontró el control de emisión fiscal esperado en %', target;
    end if;
    execute replace(definition, existing, replacement);
  end loop;
end;
$migration$;

create function public.issue_abaco_subscription_invoice(p_event jsonb, p_software jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  request public.abaco_subscription_invoice_requests%rowtype;
  account jsonb;
  invoice_id uuid;
  tenant uuid := (p_event->>'tenantId')::uuid;
  payment uuid := (p_event->>'paymentId')::uuid;
  v_paid_at timestamptz := (p_event->>'paidAt')::timestamptz;
  base numeric := (p_event->>'netCents')::numeric / 100;
  total numeric := (p_event->>'totalCents')::numeric / 100;
  vat numeric := (p_event->>'vatPercent')::numeric;
  series text;
  concept text;
begin
  if payment is null or tenant is null or v_paid_at is null or v_paid_at > now()
     or base is null or base <= 0 or vat is distinct from 21 or total is distinct from base + round(base * vat / 100, 2) then
    raise exception 'El cobro no coincide con el desglose fiscal soportado' using errcode = '22023';
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
  insert into public.invoices (client_id, billing_source, series, subtotal, tax_amount, total,
    issue_date, due_date, operation_date, is_client_visible)
  values ((account->>'clientId')::uuid, 'abaco_subscription', series, base, total - base, total,
    (now() at time zone 'Europe/Madrid')::date, (v_paid_at at time zone 'Europe/Madrid')::date,
    (v_paid_at at time zone 'Europe/Madrid')::date, true) returning id into invoice_id;
  insert into public.invoice_items(invoice_id, description, quantity, unit_price, vat_rate)
    values (invoice_id, concept, 1, base, vat);
  insert into public.abaco_subscription_invoice_requests(payment_id, tenant_id, payload, invoice_id)
    values (payment, tenant, p_event, invoice_id);
  perform public.issue_invoice_with_number_and_verifactu_outbox(invoice_id, p_software);
  insert into public.invoice_payments(invoice_id, amount, status, payment_method, confirmed_at)
    values (invoice_id, total, 'confirmed', 'card', v_paid_at);
  update public.invoices set status = 'paid', paid_at = v_paid_at,
    payment_method = 'card' where id = invoice_id;
  return invoice_id;
end;
$$;

revoke all on function public.can_issue_abaco_subscription_invoice(uuid) from public, anon, authenticated, service_role;
revoke all on function public.prepare_abaco_billing_account(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.issue_abaco_subscription_invoice(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.prepare_abaco_billing_account(uuid,jsonb),
  public.issue_abaco_subscription_invoice(jsonb,jsonb) to service_role;

create function public.begin_abaco_invoice_email(p_payment uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare request public.abaco_subscription_invoice_requests%rowtype;
  fiscal_status text;
begin
  select * into strict request from public.abaco_subscription_invoice_requests r
    where r.payment_id = p_payment for update;
  select i.verifactu_status::text into strict fiscal_status from public.invoices i where i.id = request.invoice_id;
  if fiscal_status = 'rejected' then return 'fiscal_review'; end if;
  if fiscal_status <> 'accepted' then return 'fiscal_pending'; end if;
  if request.email_sent_at is not null then return 'sent'; end if;
  -- Resend retains its idempotency key for 24 hours. Beyond that don't risk
  -- a second email when the response to the original attempt was lost.
  if request.email_first_attempt_at < now() - interval '23 hours' then return 'review'; end if;
  update public.abaco_subscription_invoice_requests set email_first_attempt_at = coalesce(email_first_attempt_at, now())
    where payment_id = p_payment;
  return 'send';
end;
$$;

create function public.finish_abaco_invoice_email(p_payment uuid, p_provider_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.abaco_subscription_invoice_requests r where r.payment_id = p_payment
    and r.email_sent_at is null for update;
  if not found then return; end if;
  insert into public.invoice_deliveries(invoice_id, channel, recipient, provider_message_id)
  select r.invoice_id, 'email', r.payload->'recipient'->>'email', p_provider_id
  from public.abaco_subscription_invoice_requests r
  where r.payment_id = p_payment;
  update public.abaco_subscription_invoice_requests set email_sent_at = now()
    where payment_id = p_payment and email_sent_at is null;
end;
$$;

revoke all on function public.begin_abaco_invoice_email(uuid), public.finish_abaco_invoice_email(uuid,text)
  from public, anon, authenticated;
grant execute on function public.begin_abaco_invoice_email(uuid), public.finish_abaco_invoice_email(uuid,text)
  to service_role;
