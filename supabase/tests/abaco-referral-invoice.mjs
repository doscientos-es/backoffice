// PGlite with synthetic accounts; the fiscal issuer is stubbed, not sent to AEAT.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated;
  create table public.abaco_subscription_invoice_requests (
    payment_id uuid primary key, tenant_id uuid, merchant_order text, payload jsonb, invoice_id uuid
  );
  create table public.settings (id integer, invoice_series text);
  insert into public.settings values (1, 'TEST');
  create table public.invoices (
    id uuid primary key default gen_random_uuid(), client_id uuid, billing_source text, series text,
    number int,
    subtotal numeric, tax_amount numeric, total numeric, issue_date date, due_date date,
    operation_date date, is_client_visible boolean, status text, paid_at timestamptz, payment_method text
  );
  create table public.invoice_items (invoice_id uuid, description text, quantity numeric, unit_price numeric, vat_rate numeric);
  create table public.invoice_payments (invoice_id uuid, amount numeric, status text, payment_method text, confirmed_at timestamptz);
  create function public.prepare_abaco_billing_account(uuid, jsonb) returns jsonb language sql as $$
    select '{"status":"ready","clientId":"00000000-0000-4000-8000-000000000001"}'::jsonb
  $$;
  create function public.issue_invoice_with_number_and_verifactu_outbox(uuid, jsonb) returns void language sql as $$
    update public.invoices i set number = (select coalesce(max(p.number),0)+1 from public.invoices p where p.series=i.series)
      where i.id=$1
  $$;
`)
await db.exec(
  await readFile(
    new URL('../migrations/20261123202731_abaco_referral_invoice.sql', import.meta.url),
    'utf8',
  ),
)
await db.exec(
  await readFile(
    new URL('../migrations/20261124073605_abaco_upgrade_invoice_concepts.sql', import.meta.url),
    'utf8',
  ),
)
const event = {
  paymentId: '00000000-0000-4000-8000-000000000002',
  tenantId: '00000000-0000-4000-8000-000000000003',
  order: '1234TEST',
  paidAt: '2026-01-01T00:00:00Z',
  startsAt: '2026-01-01',
  endsAt: '2026-02-01',
  plan: 'standard',
  netCents: 0,
  totalCents: 0,
  vatPercent: 21,
  recipient: {},
  referralDiscount: { originalNetCents: 1000, discountCents: 1210 },
}
const issue = (value) =>
  db.query('select public.issue_abaco_subscription_invoice($1, $2) as id', [
    JSON.stringify(value),
    '{}',
  ])
const id = (await issue(event)).rows[0].id
assert.equal((await issue(event)).rows[0].id, id)
assert.equal(
  (await db.query('select count(*)::int as count from public.invoice_payments')).rows[0].count,
  0,
)
assert.equal(
  (await db.query('select status from public.invoices where id = $1', [id])).rows[0].status,
  'paid',
)
assert.match(
  (await db.query('select description from public.invoice_items where invoice_id = $1', [id]))
    .rows[0].description,
  /Descuento por referidos/,
)
await assert.rejects(issue({ ...event, referralDiscount: undefined }), /descuento justificado/)
await assert.rejects(
  issue({ ...event, referralDiscount: { originalNetCents: 1000, discountCents: 1 } }),
  /Descuento de referidos no válido/,
)
await assert.rejects(issue({ ...event, plan: 'team' }), /otros datos/)
await db.exec(
  await readFile(
    new URL('../migrations/20261127165446_menoslios_subscription_series.sql', import.meta.url),
    'utf8',
  ),
)
assert.equal((await issue(event)).rows[0].id, id)
assert.deepEqual(
  (await db.query('select series, number from public.invoices where id=$1', [id])).rows[0],
  { series: 'TEST', number: 1 },
)
await assert.rejects(
  db.query("insert into public.invoices (billing_source, series) values ('backoffice', 'ML-SUS')"),
  /reservada/,
)
await assert.rejects(db.query("update public.settings set invoice_series='ml-sus'"), /check constraint/)
const partial = {
  ...event,
  paymentId: '00000000-0000-4000-8000-000000000004',
  netCents: 983,
  totalCents: 1189,
  referralDiscount: { originalNetCents: 1000, discountCents: 21 },
}
const partialId = (await issue(partial)).rows[0].id
assert.deepEqual(
  (await db.query('select series, number from public.invoices where id=$1', [partialId])).rows[0],
  { series: 'ML-SUS', number: 1 },
)
assert.equal(
  (await db.query('select count(*)::int as count from public.invoice_payments')).rows[0].count,
  1,
)
const upgradeTypes = [
  ['ai_upgrade', 'Ampliación de IA Ábaco'],
  ['plan_upgrade', 'Ampliación de plan Ábaco'],
  ['workers_upgrade', 'Ampliación de módulo Equipo Ábaco'],
  ['procurement_upgrade', 'Ampliación de módulo Compras Ábaco'],
  ['mcp_upgrade', 'Ampliación de módulo MCP Ábaco'],
]
for (const [index, [chargeType, concept]] of upgradeTypes.entries()) {
  const upgrade = {
    ...event,
    paymentId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
    netCents: 100,
    totalCents: 121,
    referralDiscount: undefined,
    chargeType,
  }
  const upgradeId = (await issue(upgrade)).rows[0].id
  assert.equal((await issue(upgrade)).rows[0].id, upgradeId)
  assert.deepEqual(
    (await db.query('select series, number from public.invoices where id=$1', [upgradeId])).rows[0],
    { series: 'ML-SUS', number: index + 2 },
  )
  const item = await db.query(
    'select description from public.invoice_items where invoice_id = $1',
    [upgradeId],
  )
  assert.ok(item.rows[0].description.startsWith(concept))
}
await assert.rejects(issue({ ...event, chargeType: 'unknown' }), /Tipo de ampliación no válido/)
await db.close()
console.log('Ábaco referral invoice SQL checks passed')
