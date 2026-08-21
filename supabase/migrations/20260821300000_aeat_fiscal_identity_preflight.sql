-- Prevent an F1 RegistroAlta from being generated with a recipient identity
-- that has not been confirmed by AEAT's official VNifV2 census service.

alter table public.clients
  add column if not exists fiscal_verification_status text not null default 'unverified'
    check (fiscal_verification_status in ('unverified', 'verified', 'mismatch', 'unavailable', 'invalid', 'not_applicable')),
  add column if not exists fiscal_verified_nif text,
  add column if not exists fiscal_verified_name text,
  add column if not exists fiscal_verified_at timestamptz;

create table if not exists public.client_fiscal_verifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  submitted_nif text not null,
  submitted_name text not null,
  status text not null check (status in ('verified', 'mismatch', 'unavailable', 'invalid', 'not_applicable')),
  aeat_name text,
  aeat_result text,
  detail text not null check (length(detail) <= 500),
  checked_by uuid not null references public.team_members(id) on delete restrict,
  checked_at timestamptz not null default clock_timestamp()
);

alter table public.client_fiscal_verifications enable row level security;
revoke all on table public.client_fiscal_verifications from public, anon, authenticated;
create policy client_fiscal_verifications_select on public.client_fiscal_verifications
  for select using (public.is_team_member());

create or replace function public.fn_client_fiscal_verification_integrity()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if current_setting('app.aeat_validation', true) is distinct from 'on'
       and (new.fiscal_verification_status is distinct from old.fiscal_verification_status
         or new.fiscal_verified_nif is distinct from old.fiscal_verified_nif
         or new.fiscal_verified_name is distinct from old.fiscal_verified_name
         or new.fiscal_verified_at is distinct from old.fiscal_verified_at) then
      raise exception 'El estado de validación fiscal solo puede establecerlo el servicio AEAT';
    end if;
    if current_setting('app.aeat_validation', true) is distinct from 'on'
       and (new.nif is distinct from old.nif or new.name is distinct from old.name
         or new.billing_address_country is distinct from old.billing_address_country) then
      new.fiscal_verification_status := 'unverified';
      new.fiscal_verified_nif := null;
      new.fiscal_verified_name := null;
      new.fiscal_verified_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_client_fiscal_verification_integrity on public.clients;
create trigger trg_client_fiscal_verification_integrity
  before update on public.clients for each row execute function public.fn_client_fiscal_verification_integrity();

create or replace function public.record_client_fiscal_verification(
  p_client_id uuid, p_submitted_nif text, p_submitted_name text, p_status text,
  p_aeat_name text, p_aeat_result text, p_detail text, p_checked_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_client public.clients%rowtype;
begin
  if p_status not in ('verified', 'mismatch', 'unavailable', 'invalid', 'not_applicable') then raise exception 'Resultado fiscal no válido'; end if;
  select * into v_client from public.clients where id = p_client_id and deleted_at is null for update;
  if not found then raise exception 'Cliente no encontrado'; end if;
  if trim(coalesce(v_client.nif, '')) <> trim(coalesce(p_submitted_nif, ''))
     or trim(v_client.name) <> trim(coalesce(p_submitted_name, '')) then
    raise exception 'Los datos del cliente cambiaron durante la validación; vuelve a intentarlo';
  end if;
  if not exists (select 1 from public.team_members where id = p_checked_by and deleted_at is null) then raise exception 'Usuario no autorizado'; end if;
  perform set_config('app.aeat_validation', 'on', true);
  update public.clients set fiscal_verification_status = p_status,
    fiscal_verified_nif = case when p_status = 'verified' then trim(p_submitted_nif) else null end,
    fiscal_verified_name = case when p_status = 'verified' then trim(p_submitted_name) else null end,
    fiscal_verified_at = clock_timestamp() where id = p_client_id;
  insert into public.client_fiscal_verifications (client_id, submitted_nif, submitted_name, status, aeat_name, aeat_result, detail, checked_by)
  values (p_client_id, trim(p_submitted_nif), trim(p_submitted_name), p_status, nullif(trim(p_aeat_name), ''), nullif(trim(p_aeat_result), ''), left(coalesce(p_detail, ''), 500), p_checked_by);
end;
$$;
revoke all on function public.record_client_fiscal_verification(uuid, text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_client_fiscal_verification(uuid, text, text, text, text, text, text, uuid) to service_role;

do $migration$
declare v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_invoice_with_verifactu_outbox'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';
  if v_definition is null then raise exception 'No existe issue_invoice_with_verifactu_outbox'; end if;
  v_definition := replace(v_definition,
    $old$  if v_invoice.invoice_type = 'F1' and (coalesce(trim(v_client.nif), '') = '' or coalesce(trim(v_client.name), '') = '') then
    raise exception 'Una factura F1 requiere NIF y razón social del destinatario';
  end if;$old$,
    $new$  if v_invoice.invoice_type = 'F1' then
    if upper(coalesce(trim(v_client.billing_address_country), 'ES')) <> 'ES' then
      raise exception 'Las facturas F1 para destinatarios extranjeros requieren soporte de identificación extranjera antes de emitirse';
    end if;
    if coalesce(trim(v_client.nif), '') = '' or coalesce(trim(v_client.name), '') = '' then
      raise exception 'Una factura F1 requiere NIF y razón social del destinatario';
    end if;
    if v_client.fiscal_verification_status <> 'verified'
       or v_client.fiscal_verified_nif is distinct from trim(v_client.nif)
       or v_client.fiscal_verified_name is distinct from trim(v_client.name) then
      raise exception 'El NIF y la razón social del destinatario deben validarse con AEAT antes de emitir una factura F1';
    end if;
  end if;$new$);
  if position('deben validarse con AEAT' in v_definition) = 0 then raise exception 'No se encontró el control F1 esperado'; end if;
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';