// Run with PGLITE_MODULE_PATH pointing to an isolated PGlite installation.
// This database contains only synthetic data and is never connected to Supabase.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
const migration = await readFile(
  new URL('../migrations/20261123143803_proposal_revisions.sql', import.meta.url),
  'utf8',
)

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$
    select '00000000-0000-0000-0000-000000000001'::uuid
  $$;
  create function public.current_member_role() returns text language sql as $$
    select current_setting('app.role', true)
  $$;
  create function public.can_access_proposal(uuid) returns boolean language sql as $$
    select current_setting('app.access', true) = 'yes'
  $$;
  create table public.clients (
    id uuid primary key, name text, nif text, billing_address_street text,
    billing_address_zip text, billing_address_city text, billing_address_province text,
    billing_address_country text
  );
  create table public.leads (id uuid primary key, name text, company text);
  create table public.settings (
    id integer primary key, company_name text, company_nif text, iban text,
    company_address_street text, company_address_zip text, company_address_city text,
    company_address_province text, company_address_country text
  );
  create table public.proposals (
    id uuid primary key, status text, title text, client_id uuid, lead_id uuid,
    portal_token text, portal_password_hash text, mcp_idempotency_key uuid,
    delivered_at timestamptz, sent_at timestamptz, viewed_at timestamptz,
    responded_at timestamptz, signature_data jsonb, accepted_fiscal_data jsonb,
    acceptance_email_sent_at timestamptz, acceptance_email_recipient text,
    acceptance_email_resend_id text
  );
  create table public.proposal_items (proposal_id uuid, position integer, description text);
  create table public.proposal_team_members (proposal_id uuid, position integer, member_id uuid);
  insert into settings (id, company_name) values (1, 'Proveedor ficticio');
  insert into clients (id, name) values ('00000000-0000-0000-0000-000000000002', 'Cliente ficticio');
  insert into proposals (id, status, title, client_id, portal_token, portal_password_hash, responded_at)
    values ('00000000-0000-0000-0000-000000000003', 'accepted', 'Primera',
      '00000000-0000-0000-0000-000000000002', 'test-token', 'test-hash', now());
  insert into proposal_items values ('00000000-0000-0000-0000-000000000003', 0, 'Línea inicial');
`)
await db.exec(migration)

await db.exec("update proposals set status = 'sent' where title = 'Primera'")
let { rows } = await db.query('select status, portal_token, responded_at from proposals')
assert.deepEqual(rows[0], { status: 'draft', portal_token: 'test-token', responded_at: null })
;({ rows } = await db.query('select revision_number, snapshot from proposal_revisions'))
assert.equal(rows[0].revision_number, 1)
assert.equal(rows[0].snapshot.proposal.status, 'accepted')
assert.equal(rows[0].snapshot.items[0].description, 'Línea inicial')
assert.equal(rows[0].snapshot.recipient.name, 'Cliente ficticio')
assert.equal(rows[0].snapshot.provider.name, 'Proveedor ficticio')
assert.equal('portal_token' in rows[0].snapshot.proposal, false)
assert.equal('portal_password_hash' in rows[0].snapshot.proposal, false)
await assert.rejects(db.exec('update proposal_revisions set revision_number = 42'), /immutable/)
await assert.rejects(db.exec('delete from proposal_revisions'), /immutable/)

await db.exec(
  "update proposals set status = 'rejected', title = 'Segunda'; update proposals set status = 'draft'",
)
;({ rows } = await db.query(
  'select revision_number, snapshot from proposal_revisions order by revision_number',
))
assert.deepEqual(
  rows.map((r) => r.revision_number),
  [1, 2],
)
assert.equal(rows[0].snapshot.proposal.title, 'Primera')
assert.equal(rows[1].snapshot.proposal.title, 'Segunda')
await db.exec("update proposals set status = 'accepted', delivered_at = now()")
await assert.rejects(db.exec("update proposals set status = 'draft'"), /terminada/)
;({ rows } = await db.query('select count(*)::int as count from proposal_revisions'))
assert.equal(rows[0].count, 2)

await db.exec("set app.access = 'yes'; set app.role = 'member'; set role authenticated")
;({ rows } = await db.query('select count(*)::int as count from proposal_revisions'))
assert.equal(rows[0].count, 0)
await db.exec("set app.role = 'admin'")
;({ rows } = await db.query('select count(*)::int as count from proposal_revisions'))
assert.equal(rows[0].count, 2)
await db.exec("set app.access = 'no'")
;({ rows } = await db.query('select count(*)::int as count from proposal_revisions'))
assert.equal(rows[0].count, 0)
await assert.rejects(db.exec('delete from proposal_revisions'), /permission denied/)
await db.close()
console.log('Proposal revision SQL checks passed')
