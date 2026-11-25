-- Preserve existing billing records while giving each historical client a lead.
lock table public.clients in share row exclusive mode;
do $$
declare c record; v_lead_id uuid;
begin
  for c in select id, name, contact_person, email, phone, created_by, deleted_at
    from public.clients where lead_id is null loop
    insert into public.leads (name, company, email, phone, status, source, created_by)
    values (coalesce(nullif(btrim(c.contact_person), ''), nullif(btrim(c.name), ''), 'Prueba'),
      nullif(btrim(c.name), ''), c.email, c.phone,
      case when c.deleted_at is null then 'won'::public.lead_status else 'archived'::public.lead_status end,
      'client-migration', c.created_by) returning id into v_lead_id;
    update public.clients set lead_id = v_lead_id where id = c.id;
  end loop;
end $$;

-- Compatibility for older client-creation flows during the transition.
create function public.ensure_client_has_lead() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.lead_id is null then
    insert into public.leads (name, company, email, phone, status, source, created_by)
    values (coalesce(nullif(btrim(new.contact_person), ''), nullif(btrim(new.name), ''), 'Prueba'),
      nullif(btrim(new.name), ''), new.email, new.phone,
      case when new.deleted_at is null then 'won'::public.lead_status else 'archived'::public.lead_status end,
      'client-migration', new.created_by) returning id into new.lead_id;
  end if;
  return new;
end $$;
revoke all on function public.ensure_client_has_lead() from public, anon, authenticated;
create trigger trg_ensure_client_has_lead before insert on public.clients
  for each row execute function public.ensure_client_has_lead();
do $$ begin
  if exists (select 1 from public.clients where lead_id is null) then
    raise exception 'Client lead backfill incomplete';
  end if;
end $$;