// This test uses only a new in-memory database and synthetic records.
import assert from 'node:assert/strict'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated;
  create type public.lead_status as enum ('new', 'won', 'archived');
  create table public.leads (
    id uuid primary key default gen_random_uuid(), name text not null, company text,
    email text, phone text, status public.lead_status not null, source text, created_by uuid
  );
  create table public.clients (
    id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads(id),
    name text not null, contact_person text, email text, phone text, created_by uuid,
    deleted_at timestamptz
  );
  insert into public.leads (id, name, status) values
    ('00000000-0000-0000-0000-000000000001', 'Existing lead', 'new');
  insert into public.clients (id, lead_id, name, contact_person, email, deleted_at) values
    ('00000000-0000-0000-0000-000000000011', null, 'Example Ltd', 'Example contact', 'contact@example.test', null),
    ('00000000-0000-0000-0000-000000000012', null, 'Old client', null, null, '2020-01-01'),
    ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Existing', null, null, null);
`)

const migration = `
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
`
await db.exec(migration)
const rows = (
  await db.query(`select c.id, c.lead_id, l.name, l.company, l.email, l.status
  from public.clients c join public.leads l on l.id = c.lead_id order by c.id`)
).rows
assert.equal(rows.length, 3)
assert.equal(rows[0].name, 'Example contact')
assert.equal(rows[0].company, 'Example Ltd')
assert.equal(rows[0].email, 'contact@example.test')
assert.equal(rows[0].status, 'won')
assert.equal(rows[1].status, 'archived')
assert.equal(rows[2].lead_id, '00000000-0000-0000-0000-000000000001')
await db.exec(`insert into public.clients (name) values ('Future client');`)
assert.equal(
  (await db.query(`select count(*)::int as n from public.clients where lead_id is null`)).rows[0].n,
  0,
)
await db.close()
