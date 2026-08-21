-- Follow-up hardening for the AEAT fiscal preflight. The first migration is
-- immutable in production; this one normalizes Spanish NIFs and makes the
-- cached census confirmation intentionally short-lived.

create or replace function public.fn_client_fiscal_verification_integrity()
returns trigger language plpgsql set search_path = public as $$
begin
  if upper(coalesce(trim(new.billing_address_country), 'ES')) = 'ES' and new.nif is not null then
    new.nif := regexp_replace(upper(regexp_replace(trim(new.nif), '[[:space:].-]', '', 'g')), '^ES', '');
  end if;
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
  before insert or update on public.clients for each row execute function public.fn_client_fiscal_verification_integrity();

create or replace function public.record_client_fiscal_verification(
  p_client_id uuid, p_submitted_nif text, p_submitted_name text, p_status text,
  p_aeat_name text, p_aeat_result text, p_detail text, p_checked_by uuid
) returns void language plpgsql security definer set search_path = public as $$
declare v_client public.clients%rowtype; v_nif text;
begin
  if p_status not in ('verified', 'mismatch', 'unavailable', 'invalid', 'not_applicable') then raise exception 'Resultado fiscal no válido'; end if;
  select * into v_client from public.clients where id = p_client_id and deleted_at is null for update;
  if not found then raise exception 'Cliente no encontrado'; end if;
  v_nif := regexp_replace(upper(regexp_replace(trim(coalesce(v_client.nif, '')), '[[:space:].-]', '', 'g')), '^ES', '');
  if v_nif <> trim(coalesce(p_submitted_nif, '')) or trim(v_client.name) <> trim(coalesce(p_submitted_name, '')) then
    raise exception 'Los datos del cliente cambiaron durante la validación; vuelve a intentarlo';
  end if;
  if not exists (select 1 from public.team_members where id = p_checked_by and deleted_at is null) then raise exception 'Usuario no autorizado'; end if;
  perform set_config('app.aeat_validation', 'on', true);
  update public.clients set fiscal_verification_status = p_status,
    fiscal_verified_nif = case when p_status = 'verified' then v_nif else null end,
    fiscal_verified_name = case when p_status = 'verified' then trim(p_submitted_name) else null end,
    fiscal_verified_at = clock_timestamp() where id = p_client_id;
  insert into public.client_fiscal_verifications (client_id, submitted_nif, submitted_name, status, aeat_name, aeat_result, detail, checked_by)
  values (p_client_id, v_nif, trim(p_submitted_name), p_status, nullif(trim(p_aeat_name), ''), nullif(trim(p_aeat_result), ''), left(coalesce(p_detail, ''), 500), p_checked_by);
end;
$$;

do $migration$
declare v_definition text;
begin
  select pg_get_functiondef(p.oid) into v_definition from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'issue_invoice_with_verifactu_outbox'
     and pg_get_function_identity_arguments(p.oid) = 'p_invoice_id uuid, p_software jsonb';
  if v_definition is null then raise exception 'No existe issue_invoice_with_verifactu_outbox'; end if;
  v_definition := replace(v_definition,
    $old$    if v_client.fiscal_verification_status <> 'verified'
       or v_client.fiscal_verified_nif is distinct from trim(v_client.nif)
       or v_client.fiscal_verified_name is distinct from trim(v_client.name) then
      raise exception 'El NIF y la razón social del destinatario deben validarse con AEAT antes de emitir una factura F1';
    end if;$old$,
    $new$    if v_client.fiscal_verification_status <> 'verified'
       or v_client.fiscal_verified_at is null
       or v_client.fiscal_verified_at < clock_timestamp() - interval '24 hours'
       or v_client.fiscal_verified_nif is distinct from regexp_replace(upper(regexp_replace(trim(v_client.nif), '[[:space:].-]', '', 'g')), '^ES', '')
       or v_client.fiscal_verified_name is distinct from trim(v_client.name) then
      raise exception 'El NIF y la razón social del destinatario deben validarse con AEAT en las últimas 24 horas antes de emitir una factura F1';
    end if;$new$);
  if position('validarse con AEAT en las últimas 24 horas' in v_definition) = 0 then raise exception 'No se encontró el control F1 de prevalidación esperado'; end if;
  v_definition := replace(v_definition,
    $old$'clientNif', v_client.nif,$old$,
    $new$'clientNif', regexp_replace(upper(regexp_replace(trim(v_client.nif), '[[:space:].-]', '', 'g')), '^ES', ''),$new$);
  if position($needle$'clientNif', regexp_replace(upper(regexp_replace(trim(v_client.nif), '[[:space:].-]', '', 'g')), '^ES', '')$needle$ in v_definition) = 0 then
    raise exception 'No se encontró el NIF del destinatario en el payload fiscal';
  end if;
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';