// Uses a local PGlite installation and synthetic data only.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('app.uid', true), '')::uuid
  $$;
  create function public.is_team_member() returns boolean language sql as $$
    select current_setting('app.member', true) = 'yes'
  $$;
  create table public.team_members (id uuid primary key);
  insert into public.team_members values
    ('00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000002');
`)
await db.exec(
  await readFile(
    new URL('../migrations/20261123150000_team_member_signatures.sql', import.meta.url),
    'utf8',
  ),
)
await db.exec(`
  set role authenticated;
  set app.uid = '00000000-0000-0000-0000-000000000001';
  set app.member = 'yes';
  insert into team_member_signatures(member_id, signature)
  values ('00000000-0000-0000-0000-000000000001', '{"version":1}');
`)
await assert.rejects(
  db.exec(`insert into team_member_signatures(member_id, signature)
    values ('00000000-0000-0000-0000-000000000002', '{"version":1}')`),
  /row-level security/,
)
await db.exec("set app.uid = '00000000-0000-0000-0000-000000000002'")
let { rows } = await db.query('select count(*)::int as count from team_member_signatures')
assert.equal(rows[0].count, 0)
await db.exec(
  "update team_member_signatures set signature = '{}'::jsonb; delete from team_member_signatures",
)
await db.exec("set app.uid = '00000000-0000-0000-0000-000000000001'")
;({ rows } = await db.query('select signature from team_member_signatures'))
assert.deepEqual(rows[0].signature, { version: 1 })
await db.exec("set app.member = 'no'")
;({ rows } = await db.query('select count(*)::int as count from team_member_signatures'))
assert.equal(rows[0].count, 0)
await db.close()
console.log('Personal signature SQL checks passed')
