-- =============================================================================
-- VERI*FACTU durable ledger and transactional outbox
--
-- Fiscal records are append-only. Delivery state is deliberately kept in a
-- separate mutable outbox so transient AEAT/network failures never alter the
-- evidence of what the SIF generated.
-- =============================================================================

create table if not exists public.verifactu_ledger (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  record_type text not null check (record_type in ('alta', 'anulacion')),
  issuer_nif text not null,
  chain_sequence bigint not null,
  invoice_number text not null,
  invoice_issue_date date not null,
  invoice_type text,
  tax_amount numeric(12,2),
  total numeric(12,2),
  previous_ledger_id uuid references public.verifactu_ledger(id) on delete restrict,
  previous_hash text,
  current_hash text not null check (current_hash ~ '^[A-F0-9]{64}$'),
  generated_at timestamptz not null,
  generated_at_local text not null,
  record_payload jsonb not null check (jsonb_typeof(record_payload) = 'object'),
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (invoice_id, record_type),
  unique (issuer_nif, chain_sequence)
);

create index if not exists verifactu_ledger_invoice_idx
  on public.verifactu_ledger(invoice_id, created_at);

create table if not exists public.verifactu_outbox (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null unique references public.verifactu_ledger(id) on delete restrict,
  state text not null default 'queued'
    check (state in ('queued', 'processing', 'accepted', 'rejected', 'retryable_error')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_attempt_at timestamptz,
  accepted_at timestamptz,
  aeat_csv text,
  aeat_code text,
  response jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verifactu_outbox_due_idx
  on public.verifactu_outbox(next_attempt_at, created_at)
  where state in ('queued', 'retryable_error');

create index if not exists verifactu_outbox_processing_idx
  on public.verifactu_outbox(locked_at)
  where state = 'processing';

-- Existing accepted records are evidence already stored in invoices. Index them
-- in the new ledger without recalculating a hash or assigning a new timestamp.
insert into public.verifactu_ledger (
  invoice_id, record_type, issuer_nif, chain_sequence, invoice_number,
  invoice_issue_date, invoice_type, tax_amount, total, previous_hash,
  current_hash, generated_at, generated_at_local, record_payload, created_at
)
select
  i.id,
  'alta',
  trim(s.company_nif),
  i.chain_sequence,
  i.full_number,
  i.issue_date,
  i.invoice_type::text,
  i.tax_amount,
  i.total,
  i.previous_hash,
  i.current_hash,
  coalesce(i.hash_generated_at, i.verifactu_submitted_at, i.issued_at, i.created_at),
  to_char(
    coalesce(i.hash_generated_at, i.verifactu_submitted_at, i.issued_at, i.created_at)
      at time zone 'Europe/Madrid',
    'YYYY-MM-DD"T"HH24:MI:SS'
  ),
  jsonb_build_object('legacy', true, 'source', 'invoices'),
  coalesce(i.hash_generated_at, i.verifactu_submitted_at, i.issued_at, i.created_at)
from public.invoices i
cross join public.settings s
where s.id = 1
  and nullif(trim(s.company_nif), '') is not null
  and i.verifactu_status = 'accepted'
  and i.current_hash ~ '^[A-F0-9]{64}$'
  and i.chain_sequence is not null
on conflict do nothing;

-- An old accepted invoice is not a delivery job. Its outbox row only records
-- that the historical RegistroAlta has already completed, so an eventual
-- RegistroAnulacion can be generated against it without re-sending the alta.
insert into public.verifactu_outbox (ledger_id, state, accepted_at, last_attempt_at)
select l.id, 'accepted', l.generated_at, l.generated_at
from public.verifactu_ledger l
where l.record_payload @> '{"legacy": true}'::jsonb
on conflict (ledger_id) do nothing;

alter table public.verifactu_ledger enable row level security;
alter table public.verifactu_outbox enable row level security;

drop policy if exists verifactu_ledger_select on public.verifactu_ledger;
create policy verifactu_ledger_select on public.verifactu_ledger
  for select using (public.is_team_member());

drop policy if exists verifactu_outbox_select on public.verifactu_outbox;
create policy verifactu_outbox_select on public.verifactu_outbox
  for select using (public.is_team_member());

-- No user-facing mutation policy exists for either table. All writes flow
-- through the narrowly scoped SECURITY DEFINER routines below.

create or replace function public.fn_verifactu_ledger_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los registros fiscales VERI*FACTU son append-only.';
end;
$$;

drop trigger if exists trg_verifactu_ledger_immutable on public.verifactu_ledger;
create trigger trg_verifactu_ledger_immutable
  before update or delete on public.verifactu_ledger
  for each row execute function public.fn_verifactu_ledger_immutable();

-- Once the SIF has generated a record, the operational invoice must remain a
-- faithful presentation of that immutable snapshot even before AEAT responds.
-- Delivery fields themselves remain mutable so the outbox can record retries.
create or replace function public.fn_invoice_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.verifactu_status is distinct from 'accepted'::verifactu_status
     and not exists (
       select 1 from public.verifactu_ledger l where l.invoice_id = old.id
     ) then
    return new;
  end if;

  if (
    new.series is distinct from old.series or
    new.number is distinct from old.number or
    new.invoice_type is distinct from old.invoice_type or
    new.idfact is distinct from old.idfact or
    new.issue_date is distinct from old.issue_date or
    new.issued_at is distinct from old.issued_at or
    new.client_nif is distinct from old.client_nif or
    new.client_name is distinct from old.client_name or
    new.client_address is distinct from old.client_address or
    new.client_address_street is distinct from old.client_address_street or
    new.client_address_zip is distinct from old.client_address_zip or
    new.client_address_city is distinct from old.client_address_city or
    new.client_address_province is distinct from old.client_address_province or
    new.client_address_country is distinct from old.client_address_country or
    new.subtotal is distinct from old.subtotal or
    new.tax_amount is distinct from old.tax_amount or
    new.total is distinct from old.total or
    new.previous_hash is distinct from old.previous_hash or
    new.current_hash is distinct from old.current_hash or
    new.chain_sequence is distinct from old.chain_sequence or
    new.hash_generated_at is distinct from old.hash_generated_at or
    new.deleted_at is distinct from old.deleted_at
  ) then
    raise exception
      'Los campos fiscales de la factura % son inmutables una vez generado su registro VERI*FACTU.',
      old.full_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_touch_verifactu_outbox on public.verifactu_outbox;
create trigger trg_touch_verifactu_outbox
  before update on public.verifactu_outbox
  for each row execute function public.fn_touch_updated_at();

-- Prevent the legacy status action from marking an accepted fiscal record as
-- cancelled without appending the legally required RegistroAnulacion.
create or replace function public.fn_invoice_cancellation_requires_ledger()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from 'cancelled'
     and exists (
       select 1
       from public.verifactu_ledger l
       where l.invoice_id = old.id and l.record_type = 'alta'
     )
     and current_setting('app.verifactu_cancellation', true) is distinct from 'on' then
    raise exception 'Una factura con registro VERI*FACTU debe anularse mediante RegistroAnulacion.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invoice_cancellation_requires_ledger on public.invoices;
create trigger trg_invoice_cancellation_requires_ledger
  before update on public.invoices
  for each row execute function public.fn_invoice_cancellation_requires_ledger();

-- The sequence is serialised per issuer. This allows future multi-issuer use
-- without accidentally joining their independent hash chains.
create or replace function public.issue_invoice_with_verifactu_outbox(p_invoice_id uuid)
returns table (ledger_id uuid, outbox_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_client public.clients%rowtype;
  v_nif text;
  v_company_name text;
  v_previous public.verifactu_ledger%rowtype;
  v_generated_at timestamptz := clock_timestamp();
  v_generated_at_local text;
  v_hash_payload text;
  v_hash text;
  v_vat_lines jsonb;
  v_description text;
  v_ledger_id uuid;
  v_outbox_id uuid;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para emitir facturas';
  end if;

  select trim(company_nif), coalesce(company_name, '')
    into v_nif, v_company_name
    from public.settings
   where id = 1;
  if coalesce(v_nif, '') = '' then
    raise exception 'Falta el NIF de la empresa en Ajustes';
  end if;

  perform pg_advisory_xact_lock(hashtext('verifactu:' || v_nif)::bigint);

  select * into v_invoice
    from public.invoices
   where id = p_invoice_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'Factura no encontrada';
  end if;

  select l.id, o.id
    into v_ledger_id, v_outbox_id
    from public.verifactu_ledger l
    join public.verifactu_outbox o on o.ledger_id = l.id
   where l.invoice_id = v_invoice.id
     and l.record_type = 'alta';
  if found then
    ledger_id := v_ledger_id;
    outbox_id := v_outbox_id;
    return next;
    return;
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Solo se puede emitir una factura en borrador';
  end if;
  if v_invoice.verifactu_status = 'excluded' then
    raise exception 'Esta factura está excluida de VERI*FACTU';
  end if;

  select * into v_client from public.clients where id = v_invoice.client_id;
  if not found then
    raise exception 'Cliente no encontrado';
  end if;

  select
    jsonb_agg(
      jsonb_build_object(
        'rate', vat_rate,
        'base', base,
        'tax', round(base * vat_rate / 100, 2)
      ) order by vat_rate
    ),
    left(
      coalesce(string_agg(description, ', ' order by position), 'Prestación de servicios profesionales'),
      250
    )
    into v_vat_lines, v_description
    from (
      select
        vat_rate,
        round(sum(subtotal), 2) as base,
        min(position) as position,
        string_agg(description, ', ' order by position) as description
      from public.invoice_items
      where invoice_id = v_invoice.id
      group by vat_rate
    ) vat;
  if v_vat_lines is null then
    raise exception 'La factura debe tener al menos una línea';
  end if;

  select * into v_previous
    from public.verifactu_ledger
   where issuer_nif = v_nif
   order by chain_sequence desc
   limit 1;

  perform set_config('TimeZone', 'Europe/Madrid', true);
  v_generated_at_local := to_char(v_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM');
  v_hash_payload := concat(
    'IDEmisorFactura=', v_nif,
    '&NumSerieFactura=', trim(v_invoice.full_number),
    '&FechaExpedicionFactura=', to_char(v_invoice.issue_date, 'DD-MM-YYYY'),
    '&TipoFactura=', trim(v_invoice.invoice_type::text),
    '&CuotaTotal=', replace(to_char(round(v_invoice.tax_amount, 2), 'FM9999999990.00'), ',', '.'),
    '&ImporteTotal=', replace(to_char(round(v_invoice.total, 2), 'FM9999999990.00'), ',', '.'),
    '&Huella=', coalesce(v_previous.current_hash, ''),
    '&FechaHoraHusoGenRegistro=', v_generated_at_local
  );
  v_hash := upper(encode(digest(convert_to(v_hash_payload, 'UTF8'), 'sha256'), 'hex'));

  update public.invoices
     set status = 'issued',
         issued_at = v_generated_at,
         client_nif = v_client.nif,
         client_name = v_client.name,
         client_address_street = v_client.billing_address_street,
         client_address_zip = v_client.billing_address_zip,
         client_address_city = v_client.billing_address_city,
         client_address_province = v_client.billing_address_province,
         client_address_country = v_client.billing_address_country,
         idfact = concat(v_nif, '-', v_invoice.full_number, '-', to_char(v_invoice.issue_date, 'YYYYMMDD')),
         previous_hash = v_previous.current_hash,
         current_hash = v_hash,
         chain_sequence = coalesce(v_previous.chain_sequence, 0) + 1,
         hash_generated_at = v_generated_at,
         verifactu_status = 'submitted',
         verifactu_submitted_at = v_generated_at,
         verifactu_error = null
   where id = v_invoice.id;

  insert into public.verifactu_ledger (
    invoice_id, record_type, issuer_nif, chain_sequence, invoice_number,
    invoice_issue_date, invoice_type, tax_amount, total, previous_ledger_id,
    previous_hash, current_hash, generated_at, generated_at_local, record_payload, created_by
  ) values (
    v_invoice.id, 'alta', v_nif, coalesce(v_previous.chain_sequence, 0) + 1,
    v_invoice.full_number, v_invoice.issue_date, v_invoice.invoice_type::text,
    v_invoice.tax_amount, v_invoice.total, v_previous.id, v_previous.current_hash,
    v_hash, v_generated_at, v_generated_at_local,
    jsonb_build_object(
      'recordType', 'alta', 'nif', v_nif, 'invoiceNumber', v_invoice.full_number,
      'invoiceType', v_invoice.invoice_type, 'issueDate', v_invoice.issue_date,
      'taxAmount', v_invoice.tax_amount, 'total', v_invoice.total,
      'previousHash', v_previous.current_hash, 'generatedAt', v_generated_at,
      'emisorName', v_company_name, 'clientNif', v_client.nif, 'clientName', v_client.name,
      'descriptionOperacion', v_description, 'vatLines', v_vat_lines,
      'previousInvoiceNumber', v_previous.invoice_number,
      'previousIssueDate', v_previous.invoice_issue_date
    ),
    auth.uid()
  ) returning id into v_ledger_id;

  insert into public.verifactu_outbox (ledger_id)
  values (v_ledger_id)
  returning id into v_outbox_id;

  ledger_id := v_ledger_id;
  outbox_id := v_outbox_id;
  return next;
end;
$$;

create or replace function public.cancel_invoice_with_verifactu_outbox(p_invoice_id uuid)
returns table (ledger_id uuid, outbox_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invoice public.invoices%rowtype;
  v_nif text;
  v_company_name text;
  v_original public.verifactu_ledger%rowtype;
  v_previous public.verifactu_ledger%rowtype;
  v_generated_at timestamptz := clock_timestamp();
  v_generated_at_local text;
  v_hash_payload text;
  v_hash text;
  v_ledger_id uuid;
  v_outbox_id uuid;
begin
  if coalesce(public.current_member_role()::text, '') not in ('owner', 'admin') then
    raise exception 'No autorizado para anular facturas';
  end if;

  select trim(company_nif), coalesce(company_name, '')
    into v_nif, v_company_name
    from public.settings where id = 1;
  if coalesce(v_nif, '') = '' then
    raise exception 'Falta el NIF de la empresa en Ajustes';
  end if;
  perform pg_advisory_xact_lock(hashtext('verifactu:' || v_nif)::bigint);

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or v_invoice.deleted_at is not null then
    raise exception 'Factura no encontrada';
  end if;

  select * into v_original from public.verifactu_ledger
   where invoice_id = v_invoice.id and record_type = 'alta';
  if not found then
    raise exception 'La factura no tiene un RegistroAlta VERI*FACTU';
  end if;
  if not exists (
    select 1 from public.verifactu_outbox where ledger_id = v_original.id and state = 'accepted'
  ) then
    raise exception 'Solo se pueden anular registros aceptados por la AEAT';
  end if;

  select l.id, o.id into v_ledger_id, v_outbox_id
    from public.verifactu_ledger l
    join public.verifactu_outbox o on o.ledger_id = l.id
   where l.invoice_id = v_invoice.id and l.record_type = 'anulacion';
  if found then
    ledger_id := v_ledger_id;
    outbox_id := v_outbox_id;
    return next;
    return;
  end if;

  select * into v_previous from public.verifactu_ledger
   where issuer_nif = v_nif order by chain_sequence desc limit 1;
  perform set_config('TimeZone', 'Europe/Madrid', true);
  v_generated_at_local := to_char(v_generated_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM');
  v_hash_payload := concat(
    'IDEmisorFacturaAnulada=', v_nif,
    '&NumSerieFacturaAnulada=', trim(v_original.invoice_number),
    '&FechaExpedicionFacturaAnulada=', to_char(v_original.invoice_issue_date, 'DD-MM-YYYY'),
    '&Huella=', coalesce(v_previous.current_hash, ''),
    '&FechaHoraHusoGenRegistro=', v_generated_at_local
  );
  v_hash := upper(encode(digest(convert_to(v_hash_payload, 'UTF8'), 'sha256'), 'hex'));

  perform set_config('app.verifactu_cancellation', 'on', true);
  update public.invoices set status = 'cancelled' where id = v_invoice.id;

  insert into public.verifactu_ledger (
    invoice_id, record_type, issuer_nif, chain_sequence, invoice_number,
    invoice_issue_date, previous_ledger_id, previous_hash, current_hash,
    generated_at, generated_at_local, record_payload, created_by
  ) values (
    v_invoice.id, 'anulacion', v_nif, coalesce(v_previous.chain_sequence, 0) + 1,
    v_original.invoice_number, v_original.invoice_issue_date, v_previous.id,
    v_previous.current_hash, v_hash, v_generated_at, v_generated_at_local,
    jsonb_build_object(
      'recordType', 'anulacion', 'nif', v_nif,
      'cancelledInvoiceNumber', v_original.invoice_number,
      'cancelledInvoiceIssueDate', v_original.invoice_issue_date,
      'previousHash', v_previous.current_hash, 'generatedAt', v_generated_at,
      'emisorName', v_company_name, 'previousInvoiceNumber', v_previous.invoice_number,
      'previousIssueDate', v_previous.invoice_issue_date,
      'sinRegistroPrevio', 'N', 'rechazoPrevio', 'N'
    ), auth.uid()
  ) returning id into v_ledger_id;

  insert into public.verifactu_outbox (ledger_id) values (v_ledger_id)
  returning id into v_outbox_id;
  ledger_id := v_ledger_id;
  outbox_id := v_outbox_id;
  return next;
end;
$$;

-- A worker claims one job at a time. The conditional update and lock owner make
-- immediate delivery and the scheduled retry mutually exclusive.
create or replace function public.claim_verifactu_outbox(
  p_outbox_id uuid,
  p_worker_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_ledger_id uuid;
begin
  update public.verifactu_outbox
     set state = 'processing',
         locked_at = clock_timestamp(),
         locked_by = p_worker_id,
         last_attempt_at = clock_timestamp(),
         attempt_count = attempt_count + 1
   where id = p_outbox_id
     and state in ('queued', 'retryable_error')
     and next_attempt_at <= clock_timestamp()
   returning ledger_id into v_ledger_id;
  return v_ledger_id;
end;
$$;

create or replace function public.claim_due_verifactu_outboxes(
  p_limit integer,
  p_worker_id text
)
returns table (outbox_id uuid, ledger_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A crashed serverless invocation must not strand a record forever. The
  -- scheduled caller subsequently claims it as a normal retry.
  update public.verifactu_outbox
     set state = 'retryable_error',
         next_attempt_at = clock_timestamp(),
         locked_at = null,
         locked_by = null,
         last_error = coalesce(last_error, 'El procesamiento anterior expiró')
   where state = 'processing'
     and locked_at < clock_timestamp() - interval '15 minutes';

  return query
  with due as (
    select id
      from public.verifactu_outbox
     where state in ('queued', 'retryable_error')
       and next_attempt_at <= clock_timestamp()
     order by next_attempt_at, created_at
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 1), 50))
  ), claimed as (
    update public.verifactu_outbox o
       set state = 'processing',
           locked_at = clock_timestamp(),
           locked_by = p_worker_id,
           last_attempt_at = clock_timestamp(),
           attempt_count = o.attempt_count + 1
      from due
     where o.id = due.id
     returning o.id, o.ledger_id
  ) select id, ledger_id from claimed;
end;
$$;

create or replace function public.complete_verifactu_outbox(
  p_outbox_id uuid,
  p_worker_id text,
  p_result text,
  p_csv text default null,
  p_aeat_code text default null,
  p_response jsonb default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger public.verifactu_ledger%rowtype;
  v_attempt_count integer;
begin
  if p_result not in ('accepted', 'rejected', 'error') then
    raise exception 'Resultado de outbox no válido';
  end if;

  select l.*, o.attempt_count into v_ledger, v_attempt_count
    from public.verifactu_outbox o
    join public.verifactu_ledger l on l.id = o.ledger_id
   where o.id = p_outbox_id
     and o.state = 'processing'
     and o.locked_by = p_worker_id
   for update of o;
  if not found then
    return false;
  end if;

  update public.verifactu_outbox
     set state = case p_result
           when 'accepted' then 'accepted'
           when 'rejected' then 'rejected'
           else 'retryable_error'
         end,
         accepted_at = case when p_result = 'accepted' then clock_timestamp() else null end,
         aeat_csv = p_csv,
         aeat_code = p_aeat_code,
         response = p_response,
         last_error = case when p_result = 'accepted' then null else left(coalesce(p_error, 'Error de envío a AEAT'), 2000) end,
         next_attempt_at = case
           when p_result = 'error' then clock_timestamp() + make_interval(
             mins => least(360, power(2, least(v_attempt_count, 8))::integer)
           )
           else next_attempt_at
         end,
         locked_at = null,
         locked_by = null
   where id = p_outbox_id;

  if v_ledger.record_type = 'alta' then
    update public.invoices
       set verifactu_status = case
             when p_result = 'accepted' then 'accepted'::verifactu_status
             when p_result = 'rejected' then 'rejected'::verifactu_status
             else 'error'::verifactu_status
           end,
           verifactu_csv = p_csv,
           verifactu_response = p_response,
           verifactu_error = case when p_result = 'accepted' then null else left(coalesce(p_error, 'Error de envío a AEAT'), 2000) end
     where id = v_ledger.invoice_id;
  end if;
  return true;
end;
$$;

revoke all on table public.verifactu_ledger, public.verifactu_outbox from public, anon, authenticated;
grant select on public.verifactu_ledger, public.verifactu_outbox to authenticated;

revoke all on function public.issue_invoice_with_verifactu_outbox(uuid) from public, anon, authenticated;
grant execute on function public.issue_invoice_with_verifactu_outbox(uuid) to authenticated;
revoke all on function public.cancel_invoice_with_verifactu_outbox(uuid) from public, anon, authenticated;
grant execute on function public.cancel_invoice_with_verifactu_outbox(uuid) to authenticated;
revoke all on function public.claim_verifactu_outbox(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_verifactu_outbox(uuid, text) to service_role;
revoke all on function public.claim_due_verifactu_outboxes(integer, text) from public, anon, authenticated;
grant execute on function public.claim_due_verifactu_outboxes(integer, text) to service_role;
revoke all on function public.complete_verifactu_outbox(uuid, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_verifactu_outbox(uuid, text, text, text, text, jsonb, text) to service_role;
