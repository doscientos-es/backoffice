// Synthetic, isolated PostgreSQL fixtures; never connects to Supabase.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated;
  create type public.expense_recurrence as enum ('none', 'monthly', 'quarterly', 'yearly');
  create function public.has_valid_mcp_access_token() returns boolean language sql as
    $$ select coalesce(current_setting('test.mcp_allowed', true), '') = 'yes' $$;
  create function public.mcp_assert_commercial_relationship(uuid, uuid, uuid) returns void
    language plpgsql as $$ begin return; end $$;
  create table public.proposals (
    id uuid primary key default gen_random_uuid(), lead_id uuid, client_id uuid, project_id uuid,
    number text, title text, status text, currency text, subtotal numeric, tax_amount numeric, total numeric,
    valid_until date, notes text, context_markdown text, problems jsonb, solutions jsonb, terms text,
    scope_modules jsonb, deliverables text, acceptance_criteria text, payment_schedule text,
    payment_plan jsonb, payment_terms text, change_management_terms text, maintenance_options jsonb,
    maintenance_selected_plan_id text, mcp_idempotency_key uuid, timeline jsonb not null default '[]',
    development_approach text, discount_type text not null default 'none',
    discount_value numeric not null default 0, discount_reason text,
    version bigint not null default 1, deleted_at timestamptz, updated_at timestamptz
  );
  create table public.proposal_items (proposal_id uuid, position integer, description text,
    quantity numeric, unit_price numeric, vat_rate numeric, billing_cycle public.expense_recurrence,
    discount_percent numeric not null default 0, discount_reason text);
  create table public.activity_log (entity_type text, entity_id uuid, action text, details jsonb);
  create function public.bump_version() returns trigger language plpgsql as
    $$ begin new.version := old.version + 1; return new; end $$;
  create trigger bump_version before update on public.proposals for each row execute function public.bump_version();
`)
const original = await readFile(
  new URL('../migrations/20260903110000_mcp_proposals_projects.sql', import.meta.url),
  'utf8',
)
for (const name of [
  'mcp_validate_proposal_items',
  'mcp_validate_proposal_patch',
  'mcp_create_proposal',
  'mcp_update_proposal',
]) {
  const start = original.indexOf(`create or replace function public.${name}(`)
  assert.notEqual(start, -1)
  const end = original.indexOf('\n$$;', start)
  assert.notEqual(end, -1)
  await db.exec(original.slice(start, end + 4))
}
const discountMigration = await readFile(
  new URL('../migrations/20261014100000_proposal_discounts.sql', import.meta.url),
  'utf8',
)
const totalsStart = discountMigration.indexOf(
  'create or replace function public.proposal_net_totals(',
)
const totalsEnd = discountMigration.indexOf('\n$$;', totalsStart)
assert.ok(totalsStart >= 0 && totalsEnd > totalsStart)
await db.exec(discountMigration.slice(totalsStart, totalsEnd + 4))
await db.exec(
  await readFile(
    new URL('../migrations/20261125114004_mcp_proposal_timeline.sql', import.meta.url),
    'utf8',
  ),
)
await db.exec(
  await readFile(
    new URL('../migrations/20261125133000_mcp_proposal_development_approach.sql', import.meta.url),
    'utf8',
  ),
)
await db.exec(
  await readFile(
    new URL('../migrations/20261125143000_mcp_proposal_discounts.sql', import.meta.url),
    'utf8',
  ),
)
await db.exec(`
  revoke all on function public.mcp_create_proposal(uuid, uuid, jsonb, jsonb, uuid) from public;
  revoke all on function public.mcp_update_proposal(uuid, bigint, jsonb, jsonb) from public;
  grant execute on function public.mcp_create_proposal(uuid, uuid, jsonb, jsonb, uuid) to anon;
  grant execute on function public.mcp_update_proposal(uuid, bigint, jsonb, jsonb) to anon;
  set role anon;
`)
const items = [{ description: 'Trabajo ficticio', quantity: 1, unitPrice: 100 }]
const milestone = {
  id: '44444444-4444-4444-8444-444444444444',
  title: 'Diseño',
  description: '',
  start_date: '2028-02-28',
  end_date: '2028-02-29',
}
const create = (patch, proposalItems = items) =>
  db.query('select public.mcp_create_proposal($1, null, $2, $3, null) as result', [
    '11111111-1111-4111-8111-111111111111',
    JSON.stringify(patch),
    JSON.stringify(proposalItems),
  ])
const update = (id, version, patch, proposalItems = items) =>
  db.query('select public.mcp_update_proposal($1, $2, $3, $4) as result', [
    id,
    version,
    JSON.stringify(patch),
    JSON.stringify(proposalItems),
  ])

await assert.rejects(
  create({ title: 'Sin permiso', timeline: [milestone] }),
  /Invalid MCP access token/,
)
await db.exec("set test.mcp_allowed = 'yes'")
const created = (
  await create({
    title: 'Propuesta ficticia',
    timeline: [milestone],
    development_approach: '  Revisiones acordadas  ',
  })
).rows[0].result
await db.exec('reset role')
const read = async () =>
  (
    await db.query(
      'select timeline, development_approach, version from public.proposals where id = $1',
      [created.id],
    )
  ).rows[0]
assert.deepEqual((await read()).timeline, [milestone])
assert.equal((await read()).development_approach, 'Revisiones acordadas')
await db.exec('set role anon')
await assert.rejects(update(created.id, 99, { timeline: [] }), /version conflict/)
await update(created.id, 1, { notes: 'Mantener planificación' })
await db.exec('reset role')
assert.deepEqual((await read()).timeline, [milestone])
assert.equal((await read()).development_approach, 'Revisiones acordadas')
await db.exec('set role anon')
for (const bad of [
  null,
  {},
  [{ ...milestone, start_date: '2027-02-29' }],
  [{ ...milestone, end_date: '2028-02-27' }],
  [{ ...milestone, description: null }],
  Array(61).fill(milestone),
]) {
  await assert.rejects(update(created.id, 2, { timeline: bad }), /timeline/i)
}
await assert.rejects(
  db.query('select public.mcp_validate_proposal_timeline($1)', ['[]']),
  /permission denied/,
)
await update(created.id, 2, { timeline: [] })
await db.exec('reset role')
assert.deepEqual((await read()).timeline, [])
await db.exec('set role anon')
for (const invalid of [{}, 1, 'x'.repeat(20001)]) {
  await assert.rejects(
    update(created.id, 3, { development_approach: invalid }),
    /development approach/i,
  )
}
await update(created.id, 3, { development_approach: '  Nuevo enfoque  ' })
await db.exec('reset role')
assert.equal((await read()).development_approach, 'Nuevo enfoque')
await db.exec('set role anon')
await update(created.id, 4, { development_approach: null })
await db.exec('reset role')
assert.equal((await read()).development_approach, null)
assert.equal(
  (
    await db.query(
      "select has_column_privilege('anon', 'public.proposals', 'development_approach', 'select') as allowed",
    )
  ).rows[0].allowed,
  true,
)
const discountedItems = [
  {
    description: 'Una vez',
    quantity: 1,
    unitPrice: 100,
    vatRate: 21,
    discountPercent: 10,
    discountReason: 'Acuerdo',
  },
  {
    description: 'Otra vez',
    quantity: 1,
    unitPrice: 100,
    vatRate: 10,
    discountPercent: 0,
    discountReason: null,
  },
  {
    description: 'Mensual',
    quantity: 1,
    unitPrice: 50,
    vatRate: 21,
    billingCycle: 'monthly',
    discountPercent: 20,
    discountReason: null,
  },
]
await db.exec('set role anon')
const discounted = (
  await create(
    {
      title: 'Descuentos',
      discount_type: 'percent',
      discount_value: 10,
      discount_reason: 'Campaña',
    },
    discountedItems,
  )
).rows[0].result
await db.exec('reset role')
const readDiscount = async () =>
  (
    await db.query(
      'select subtotal, tax_amount, total, discount_type, discount_value, discount_reason from public.proposals where id = $1',
      [discounted.id],
    )
  ).rows[0]
const readDiscountItems = async () =>
  (
    await db.query(
      'select discount_percent, discount_reason from public.proposal_items where proposal_id = $1 order by position',
      [discounted.id],
    )
  ).rows
assert.deepEqual(await readDiscount(), {
  subtotal: '171.00',
  tax_amount: '26.01',
  total: '197.01',
  discount_type: 'percent',
  discount_value: '10',
  discount_reason: 'Campaña',
})
assert.deepEqual(await readDiscountItems(), [
  { discount_percent: '10', discount_reason: 'Acuerdo' },
  { discount_percent: '0', discount_reason: null },
  { discount_percent: '20', discount_reason: null },
])
await db.exec('set role anon')
await assert.rejects(
  update(discounted.id, 1, { notes: 'No borrar' }, items),
  /include every line discount/,
)
await assert.rejects(
  update(
    discounted.id,
    1,
    { notes: 'No borrar' },
    discountedItems.map(({ discountReason, ...item }) => item),
  ),
  /include every line discount reason/,
)
await assert.rejects(
  update(discounted.id, 1, { discount_value: 101 }, discountedItems),
  /discount/i,
)
for (const bad of [-1, 101, 1.001, '10']) {
  await assert.rejects(
    update(discounted.id, 1, {}, [{ ...discountedItems[0], discountPercent: bad }]),
    /discount/i,
  )
}
await update(discounted.id, 1, { discount_type: 'amount', discount_value: 50 }, discountedItems)
await db.exec('reset role')
assert.deepEqual(await readDiscount(), {
  subtotal: '140.00',
  tax_amount: '21.29',
  total: '161.29',
  discount_type: 'amount',
  discount_value: '50',
  discount_reason: 'Campaña',
})
await db.exec('set role anon')
await update(
  discounted.id,
  2,
  {},
  discountedItems.map((item) => ({ ...item, discountPercent: 0, discountReason: null })),
)
await db.exec('reset role')
assert.deepEqual(await readDiscount(), {
  subtotal: '150.00',
  tax_amount: '23.25',
  total: '173.25',
  discount_type: 'amount',
  discount_value: '50',
  discount_reason: 'Campaña',
})
await db.exec('set role anon')
await update(
  discounted.id,
  3,
  { discount_type: 'none' },
  discountedItems.map((item) => ({ ...item, discountPercent: 0, discountReason: null })),
)
await db.exec('reset role')
assert.deepEqual(await readDiscount(), {
  subtotal: '200.00',
  tax_amount: '31.00',
  total: '231.00',
  discount_type: 'none',
  discount_value: '0',
  discount_reason: null,
})
await db.close()
console.log('MCP proposal timeline migration: isolated PostgreSQL checks passed')
