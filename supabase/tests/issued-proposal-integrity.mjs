// Isolated synthetic PostgreSQL fixtures; never connects to a Supabase project.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create function auth.role() returns text language sql as $$ select 'service_role'::text $$;
  create type public.proposal_status as enum ('draft','sent','viewed','accepted','rejected','expired');
  create function public.current_member_role() returns text language sql as $$ select 'owner'::text $$;
  create function public.can_access_proposal(uuid) returns boolean language sql as $$ select true $$;
  create table public.team_members (id uuid primary key, name text, role text, job_title text, deleted_at timestamptz);
  create table public.team_member_signatures (member_id uuid primary key, signature jsonb);
  create table public.leads (id uuid primary key, name text, company text, assigned_to uuid);
  create table public.clients (id uuid primary key, lead_id uuid, name text, nif text,
    billing_address_street text, billing_address_zip text, billing_address_city text,
    billing_address_province text, billing_address_country text);
  create table public.settings (id integer primary key, company_name text, company_nif text,
    iban text, company_address_street text, company_address_zip text, company_address_city text,
    company_address_province text, company_address_country text);
  create table public.proposals (id uuid primary key, status public.proposal_status, title text,
    client_id uuid, lead_id uuid, payment_plan jsonb, deleted_at timestamptz,
    portal_token text, portal_password_hash text, mcp_idempotency_key uuid, delivered_at timestamptz,
    sent_at timestamptz, viewed_at timestamptz, responded_at timestamptz, signature_data jsonb,
    accepted_fiscal_data jsonb, acceptance_email_sent_at timestamptz,
    acceptance_email_recipient text, acceptance_email_resend_id text);
  create table public.proposal_items (proposal_id uuid, position integer, description text);
  create table public.proposal_team_members (proposal_id uuid, position integer, member_id uuid);
  create function public.accept_proposal_with_evidence(uuid,timestamptz,text,text,text,text,jsonb,text,text,text,text)
    returns void language plpgsql as $$ begin
      update public.proposals set status = 'accepted', responded_at = $2 where id = $1;
    end $$;
  insert into public.team_members values
    ('00000000-0000-0000-0000-000000000001','Pol Ejemplo','owner','Director',null),
    ('00000000-0000-0000-0000-000000000002','Responsable ficticio','member','Ventas',null);
  insert into public.team_member_signatures values
    ('00000000-0000-0000-0000-000000000001','{"version":1,"strokes":[[{"x":1,"y":1}]]}'),
    ('00000000-0000-0000-0000-000000000002','{"version":1,"strokes":[[{"x":2,"y":2}]]}');
  insert into public.settings (id, company_name) values (1, 'Empresa ficticia');
  insert into public.leads values ('00000000-0000-0000-0000-000000000003','Lead ficticio',null,
    '00000000-0000-0000-0000-000000000002');
  insert into public.proposals (id,status,title,lead_id) values
    ('00000000-0000-0000-0000-000000000004','draft','Original','00000000-0000-0000-0000-000000000003');
  insert into public.proposal_items values ('00000000-0000-0000-0000-000000000004',0,'Original');
`)
for (const name of [
  '20261123143803_proposal_revisions.sql',
  '20261123150100_issued_proposal_integrity.sql',
]) {
  await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
}

await db.exec("update proposals set status = 'sent'")
let { rows } = await db.query('select provider_signature, document_revision from proposals')
const firstSignature = rows[0].provider_signature
assert.equal(firstSignature.name, 'Responsable ficticio')
assert.equal(rows[0].document_revision, 1)
await db.exec(
  "update team_member_signatures set signature = '{\"version\":2}' where member_id = '00000000-0000-0000-0000-000000000002'",
)
assert.deepEqual(
  (await db.query('select provider_signature from proposals')).rows[0].provider_signature,
  firstSignature,
)
await assert.rejects(db.exec("update proposals set title = 'Alterada'"), /Reabre/)
await assert.rejects(db.exec("update proposal_items set description = 'Alterada'"), /Reabre/)
await assert.rejects(db.exec('update proposals set provider_signature = null'), /firma/)
await db.exec("update proposals set status = 'draft'")
;({ rows } = await db.query('select document_revision, provider_signature from proposals'))
assert.deepEqual(rows[0], { document_revision: 2, provider_signature: null })
assert.deepEqual(
  (await db.query('select snapshot from proposal_revisions')).rows[0].snapshot.proposal
    .provider_signature,
  firstSignature,
)
await db.exec(
  "update proposal_items set description = 'Segunda'; delete from team_member_signatures where member_id = '00000000-0000-0000-0000-000000000002'; update proposals set status = 'sent'",
)
;({ rows } = await db.query('select provider_signature from proposals'))
assert.equal(rows[0].provider_signature.name, 'Pol Ejemplo')
const snapshot = JSON.stringify({ provider_signature: rows[0].provider_signature })
const accept =
  'select public.accept_proposal_with_evidence_versioned($1,$2,now(),$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)'
const args = [
  '00000000-0000-0000-0000-000000000004',
  1,
  'Cliente',
  '',
  'Acepto',
  'v',
  snapshot,
  'hash',
  'token',
  '',
  '',
]
await assert.rejects(db.query(accept, args), /ha cambiado/)
args[1] = 2
args[6] = '{}'
await assert.rejects(db.query(accept, args), /firma del proveedor/)
args[6] = snapshot
await db.query(accept, args)
assert.equal((await db.query('select status from proposals')).rows[0].status, 'accepted')
await db.exec("update proposals set status = 'sent'")
assert.equal((await db.query('select status from proposals')).rows[0].status, 'draft')
assert.equal(
  (await db.query('select count(*)::int as count from proposal_revisions')).rows[0].count,
  2,
)
await db.close()
console.log('Issued proposal integrity SQL checks passed')
