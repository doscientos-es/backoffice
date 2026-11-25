// In-memory fixtures only; no application credentials or production records.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const [lead, otherLead, unbilledLead, client, otherClient, project] = [1, 2, 3, 11, 12, 21].map(id)
const relations = [
  'projects',
  'proposals',
  'invoices',
  'subscriptions',
  'tasks',
  'attachments',
  'reminders',
]
const fiscalLink = 'client_id uuid references public.clients(id)'
const leadLink = 'lead_id uuid references public.leads(id) on delete set null'

try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create function public.current_member_role() returns text language sql as $$ select 'owner'::text $$;
    create table public.leads (id uuid primary key, deleted_at timestamptz);
    create table public.clients (id uuid primary key, ${leadLink}, deleted_at timestamptz,
      nif text, name text, billing_address_street text, billing_address_zip text,
      billing_address_city text, billing_address_province text, billing_address_country text);
    create unique index active_client_for_lead on public.clients (lead_id) where deleted_at is null;
    create table public.projects (id uuid primary key, ${fiscalLink} not null, deleted_at timestamptz,
      billing_type text, hourly_rate numeric, hourly_vat_rate numeric);
    create table public.proposals (
      id uuid primary key, ${fiscalLink}, ${leadLink}, project_id uuid references public.projects(id),
      constraint proposals_lead_or_client_chk check ((client_id is null) <> (lead_id is null))
    );
    create table public.invoices (
      id uuid primary key default gen_random_uuid(), ${fiscalLink} not null, project_id uuid references public.projects(id),
      status text not null default 'draft', fiscal_snapshot text, deleted_at timestamptz,
      series text, number int, currency text, subtotal numeric, tax_amount numeric, total numeric,
      client_nif text, client_name text, client_address_street text, client_address_zip text,
      client_address_city text, client_address_province text, client_address_country text, created_by uuid
    );
    create table public.settings (id int primary key, invoice_series text);
    create table public.invoice_items (invoice_id uuid, position int, description text, quantity numeric, unit_price numeric, vat_rate numeric);
    create table public.work_logs (project_id uuid, invoice_id uuid, work_date date, hours numeric, deleted_at timestamptz);
    create table public.subscriptions (id uuid primary key, ${fiscalLink} not null, project_id uuid references public.projects(id));
    ${relations
      .slice(4)
      .map(
        (table) =>
          `create table public.${table} (id uuid primary key, ${fiscalLink}, ${leadLink});`,
      )
      .join('\n')}
    create function public.enforce_proposal_project_commercial_relationship() returns trigger
    language plpgsql as $$ begin raise exception 'Legacy validator rejects archived projects'; end $$;
    insert into public.leads (id) values ('${lead}'), ('${otherLead}'), ('${unbilledLead}');
    insert into public.clients (id, lead_id) values ('${client}', '${lead}'), ('${otherClient}', '${otherLead}');
    insert into public.projects values ('${project}', '${client}', now());
    insert into public.proposals (id, client_id, project_id) values ('${id(22)}', '${client}', '${project}');
    insert into public.invoices (id, client_id, project_id, status, fiscal_snapshot)
      values ('${id(23)}', '${client}', '${project}', 'issued', 'immutable');
    ${relations
      .slice(3)
      .map(
        (table, i) =>
          `insert into public.${table} (id, client_id) values ('${id(i + 24)}', '${client}');`,
      )
      .join('\n')}
    create trigger trg_enforce_proposal_project_commercial_relationship
      before insert or update of client_id, lead_id, project_id on public.proposals
      for each row execute function public.enforce_proposal_project_commercial_relationship();
  `)

  const migration = await readFile(
    new URL('../migrations/20261125213817_document_lead_ownership.sql', import.meta.url),
    'utf8',
  )
  await db.exec(`begin; ${migration} commit;`)
  for (const table of relations) {
    assert.equal((await db.query(`select lead_id from public.${table}`)).rows[0].lead_id, lead)
  }

  const directProject = id(31)
  await db.query('insert into public.projects (id, lead_id) values ($1, $2)', [directProject, lead])
  await db.query('insert into public.proposals (id, lead_id, project_id) values ($1, $2, $3)', [
    id(32),
    lead,
    directProject,
  ])
  await db.query('update public.proposals set client_id = $1, lead_id = null where id = $2', [
    client,
    id(32),
  ])
  assert.deepEqual(
    (await db.query('select lead_id, client_id from public.proposals where id = $1', [id(32)]))
      .rows[0],
    {
      lead_id: lead,
      client_id: client,
    },
  )
  await assert.rejects(
    db.query('insert into public.proposals (id, lead_id, project_id) values ($1, $2, $3)', [
      id(33),
      otherLead,
      directProject,
    ]),
    /Project belongs to another lead/,
  )
  await assert.rejects(
    db.query('update public.projects set lead_id = $1 where id = $2', [otherLead, directProject]),
    { code: '23514' },
  )
  await assert.rejects(
    db.query('update public.clients set lead_id = $1 where id = $2', [otherLead, client]),
    { code: '23514' },
  )
  await assert.rejects(
    db.query('update public.invoices set client_id = $1 where id = $2', [otherClient, id(23)]),
    { code: '23514' },
  )
  assert.equal(
    (await db.query('select fiscal_snapshot from public.invoices')).rows[0].fiscal_snapshot,
    'immutable',
  )

  for (const table of relations.filter((table) => table !== 'proposals')) {
    const future = await db.query(
      `insert into public.${table} (id, client_id) values ($1, $2) returning lead_id`,
      [id(34), otherClient],
    )
    assert.equal(future.rows[0].lead_id, otherLead)
    await assert.rejects(
      db.query(`insert into public.${table} (id, client_id, lead_id) values ($1, $2, $3)`, [
        id(35),
        otherClient,
        lead,
      ]),
      { code: '23514' },
    )
  }

  const finishMigration = await readFile(
    new URL('../migrations/20261125214812_finish_commercial_lead_ownership.sql', import.meta.url),
    'utf8',
  )
  await db.exec(`begin; ${finishMigration} commit;`)
  const hourlyProject = id(40)
  await db.query(
    "insert into public.projects (id, lead_id, billing_type, hourly_rate, hourly_vat_rate) values ($1, $2, 'hourly', 100, 21)",
    [hourlyProject, unbilledLead],
  )
  const newProposal = () =>
    db.query(
      'insert into public.proposals (id, lead_id, project_id) values (gen_random_uuid(), $1, $2) returning client_id',
      [unbilledLead, hourlyProject],
    )
  assert.equal((await newProposal()).rows[0].client_id, null)
  await db.query(
    "insert into public.work_logs (project_id, work_date, hours) values ($1, '2025-01-15', 2)",
    [hourlyProject],
  )
  const hourlyInvoice = () =>
    db.query("select public.create_hourly_invoice($1, '2025-01-01', '2025-02-01', 'enero') as id", [
      hourlyProject,
    ])
  await assert.rejects(hourlyInvoice(), /Añade los datos de facturación del lead/)
  await db.query(
    "insert into public.clients (id, lead_id, nif, name) values ($1, $2, 'B123', 'Example')",
    [id(41), unbilledLead],
  )
  assert.equal((await newProposal()).rows[0].client_id, id(41))
  const invoiceId = (await hourlyInvoice()).rows[0].id
  assert.equal((await hourlyInvoice()).rows[0].id, invoiceId)
  assert.deepEqual(
    (
      await db.query(
        'select lead_id, client_id, client_nif, total::text from public.invoices where id = $1',
        [invoiceId],
      )
    ).rows[0],
    {
      lead_id: unbilledLead,
      client_id: id(41),
      client_nif: 'B123',
      total: '242.00',
    },
  )
  for (const table of ['invoices', 'subscriptions']) {
    await assert.rejects(
      db.query(`insert into public.${table} (id, client_id, project_id) values ($1, $2, $3)`, [
        id(42),
        otherClient,
        hourlyProject,
      ]),
      { code: '23514' },
    )
  }
  // The fiscal record may be replaced without changing project ownership.
  await db.query('update public.projects set client_id = $1 where id = $2', [id(41), hourlyProject])
  await db.query('update public.clients set deleted_at = now() where id = $1', [id(41)])
  await db.query('insert into public.clients (id, lead_id) values ($1, $2)', [id(43), unbilledLead])
  assert.equal((await newProposal()).rows[0].client_id, id(43))
  assert.equal((await hourlyInvoice()).rows[0].id, invoiceId)
} finally {
  await db.close()
}
