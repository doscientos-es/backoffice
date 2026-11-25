// This test uses only a new in-memory database and synthetic records.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

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

const migration = await readFile(
  new URL('../migrations/20261125211540_client_lead_backfill.sql', import.meta.url),
  'utf8',
)
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
await db.exec(`grant insert on public.clients to authenticated; set role authenticated;
  insert into public.clients (name) values ('Restricted user client'); reset role;`)
assert.equal(
  (await db.query('select count(*)::int as n from public.clients where lead_id is null')).rows[0].n,
  0,
)
const leadsBeforeFailure = (await db.query('select count(*)::int as n from public.leads')).rows[0].n
await assert.rejects(
  db.exec(`insert into public.clients (id, name) values
  ('00000000-0000-0000-0000-000000000011', 'Duplicate');`),
)
assert.equal(
  (await db.query('select count(*)::int as n from public.leads')).rows[0].n,
  leadsBeforeFailure,
)
await db.close()
