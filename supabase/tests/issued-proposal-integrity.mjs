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
const legacyAccept =
  "select public.accept_proposal_with_evidence('00000000-0000-0000-0000-000000000004',now(),'Cliente','','Acepto','v','{}','hash','token','','')"
await assert.rejects(db.exec(legacyAccept), /ha cambiado/)
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
await assert.rejects(db.exec(legacyAccept), /ha cambiado/)
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
await db.exec(`
  delete from team_member_signatures;
  insert into proposals (id, status, title) values
    ('00000000-0000-0000-0000-000000000005', 'draft', 'Sin firma');
  update proposals set status = 'sent' where id = '00000000-0000-0000-0000-000000000005';
  select public.accept_proposal_with_evidence('00000000-0000-0000-0000-000000000005',
    now(),'Cliente','','Acepto','v','{}','hash','token','','');
`)
assert.equal(
  (await db.query("select status from proposals where id = '00000000-0000-0000-0000-000000000005'"))
    .rows[0].status,
  'accepted',
)

// Apply the pending-edit migration to an isolated fixture with the version trigger.
await db.exec(`
  alter table public.proposals add column client_capacity text, add column version bigint default 1;
  create function public.fn_bump_record_version() returns trigger language plpgsql as $$
  begin new.version := old.version + 1; return new; end $$;
  create function public.fn_touch_updated_at() returns trigger language plpgsql as $$
  begin new.updated_at := now(); return new; end $$;
  alter table public.proposals add column updated_at timestamptz default now();
  create trigger trg_bump_proposals_version before update on public.proposals
    for each row execute function public.fn_bump_record_version();
  create trigger trg_touch_proposals before update on public.proposals
    for each row execute function public.fn_touch_updated_at();
`)
await db.exec(
  await readFile(
    new URL('../migrations/20261124190000_edit_pending_proposals.sql', import.meta.url),
    'utf8',
  ),
)
await db.exec(`
  create trigger protect_issued_proposal_capacity before update on public.proposals
    for each row execute function public.protect_issued_proposal_capacity();
  insert into proposals (id, status, title, client_capacity) values
    ('00000000-0000-0000-0000-000000000006', 'sent', 'Pendiente', 'business');
`)
const pendingId = '00000000-0000-0000-0000-000000000006'
const current = async () =>
  (
    await db.query('select status, document_revision, version from proposals where id = $1', [
      pendingId,
    ])
  ).rows[0]
await db.exec(`update proposals set title = 'Modificada', client_capacity = 'consumer'
  where id = '${pendingId}'`)
assert.deepEqual(await current(), { status: 'sent', document_revision: 2, version: 2 })
await assert.rejects(
  db.query(accept, [pendingId, 1, ...args.slice(2, 6), '{}', ...args.slice(7)]),
  /ha cambiado/,
)
await assert.rejects(
  db.exec(`update proposals set document_revision = 1 where id = '${pendingId}'`),
  /versión/,
)

await db.exec(`insert into proposal_items values ('${pendingId}', 0, 'Partida nueva')`)
assert.deepEqual(await current(), { status: 'sent', document_revision: 3, version: 2 })
await db.exec(
  `insert into proposal_team_members values ('${pendingId}', 0, '00000000-0000-0000-0000-000000000001')`,
)
assert.deepEqual(await current(), { status: 'sent', document_revision: 4, version: 2 })
await db.exec(`update proposals set status = 'viewed' where id = '${pendingId}';
  update proposals set payment_plan = '[]' where id = '${pendingId}';
  update proposals set status = 'expired' where id = '${pendingId}';
  update proposal_items set description = 'Editada' where proposal_id = '${pendingId}'`)
assert.deepEqual(await current(), { status: 'expired', document_revision: 6, version: 5 })

await db.exec(`update proposals set status = 'sent' where id = '${pendingId}'`)
await db.query(accept, [pendingId, 6, ...args.slice(2, 6), '{}', ...args.slice(7)])
await assert.rejects(
  db.exec(`update proposals set title = 'Bloqueada' where id = '${pendingId}'`),
  /respondida/,
)
await assert.rejects(
  db.exec(`delete from proposal_items where proposal_id = '${pendingId}'`),
  /respondida/,
)
await db.exec(`update proposals set status = 'draft' where id = '${pendingId}'`)
assert.equal((await current()).document_revision, 7)
assert.equal(
  (
    await db.query('select revision_number from proposal_revisions where proposal_id = $1', [
      pendingId,
    ])
  ).rows[0].revision_number,
  6,
)
await db.close()
console.log('Issued proposal integrity SQL checks passed')
