// Synthetic data in an isolated in-memory database only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create table public.leads (id integer primary key, logo_url text);
  create table public.clients (id integer primary key, lead_id integer, logo_url text, deleted_at timestamptz);
  insert into public.leads values (1, null), (2, 'https://example.test/new.png'), (3, null), (4, null);
  insert into public.clients values
    (1, 1, 'https://example.test/old.png', null),
    (2, 2, 'https://example.test/old.png', null),
    (3, 3, 'https://example.test/archived.png', '2020-01-01'),
    (4, 4, '  ', null);
`)
const migration = await readFile(
  new URL('../migrations/20261125224216_lead_logo.sql', import.meta.url),
  'utf8',
)
await db.exec(migration)
const leads = (await db.query('select logo_url from public.leads order by id')).rows
assert.deepEqual(
  leads.map((row) => row.logo_url),
  ['https://example.test/old.png', 'https://example.test/new.png', null, null],
)
assert.equal(
  (await db.query('select logo_url from public.clients where id = 1')).rows[0].logo_url,
  'https://example.test/old.png',
)
await db.close()
