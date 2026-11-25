import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
const lead = '10000000-0000-4000-8000-000000000001'
const member = '10000000-0000-4000-8000-000000000002'
const client = '10000000-0000-4000-8000-000000000003'

async function migration(filename) {
  return readFile(new URL(`../migrations/${filename}.sql`, import.meta.url), 'utf8')
}

try {
  await db.exec(`
    create role anon; create role authenticated;
    create type public.project_status as enum ('planning','active','cancelled');
    create table public.leads (id uuid primary key, deleted_at timestamptz);
    create table public.clients (id uuid primary key, lead_id uuid, deleted_at timestamptz);
    create table public.projects (
      id uuid default gen_random_uuid() primary key, lead_id uuid not null, client_id uuid,
      name text, description text, status public.project_status, starts_at date, ends_at date,
      billing_type text, hourly_rate numeric, hourly_vat_rate numeric, github_sync_mode text,
      github_auto_sync boolean, github_repo text, github_repo_owner text, github_repo_name text,
      github_installation_id bigint, workspace_paths text[], mcp_idempotency_key uuid,
      version bigint default 1, updated_at timestamptz default now(), deleted_at timestamptz
    );
    create table public.activity_log (entity_type text, entity_id uuid, action text, details jsonb);
    create table public.team_members (
      id uuid, name text, role text, deleted_at timestamptz, created_at timestamptz
    );
    create table public.settings (id int, internal_hourly_cost numeric);
    insert into public.settings values (1, 50);
    create table public.work_logs (
      id uuid default gen_random_uuid(), project_id uuid, member_id uuid, work_date date,
      hours numeric, note text, deleted_at timestamptz
    );
    create table public.lead_interactions (lead_id uuid, project_id uuid);
    create function public.has_valid_mcp_access_token() returns boolean language sql as $$
      select coalesce(current_setting('test.mcp_access', true), '') = 'enabled';
    $$;
    create function public.are_safe_project_workspace_paths(text[]) returns boolean language sql as $$
      select true;
    $$;
  `)
  await db.query('insert into public.leads values ($1, null)', [lead])
  await db.query('insert into public.clients values ($1, $2, null)', [client, lead])
  await db.query("insert into public.team_members values ($1, 'Example', 'owner', null, now())", [
    member,
  ])

  const projectFunctions = await migration('20260903110000_mcp_proposals_projects')
  for (const name of [
    'mcp_assert_project_client_relationship',
    'mcp_create_project',
    'mcp_update_project',
  ]) {
    const start = projectFunctions.indexOf(`create or replace function public.${name}(`)
    assert.notEqual(start, -1)
    await db.exec(projectFunctions.slice(start, projectFunctions.indexOf('$$;', start) + 3))
  }
  const relationshipFunctions = await migration('20261125214812_finish_commercial_lead_ownership')
  await db.exec(relationshipFunctions.slice(0, relationshipFunctions.indexOf('$$;') + 3))
  for (const filename of [
    '20260921100000_mcp_work_logs',
    '20260921110000_mcp_team_work_hours',
    '20260921120000_fix_mcp_global_work_hours',
    '20260923074404_fix_interaction_project_uuid_aggregate',
  ])
    await db.exec(await migration(filename))

  await db.exec(await migration('20261125220121_resolve_project_by_lead'))
  await db.exec(`create trigger resolve_project before insert on public.lead_interactions
    for each row execute function public.resolve_interaction_project();`)

  const create = (clientId, leadId, name) =>
    db.query('select public.mcp_create_project($1, $2, $3, null) as result', [
      clientId,
      leadId,
      JSON.stringify({ name }),
    ])
  await assert.rejects(create(null, lead, 'Blocked'), { code: '42501' })
  await db.exec("set test.mcp_access = 'enabled'")
  await assert.rejects(create(null, null, 'No recipient'), /Lead not found/)
  const {
    rows: [{ result: project }],
  } = await create(null, lead, 'Lead-only project')
  assert.equal(project.leadId, lead)
  assert.equal(project.clientId, null)

  const updated = await db.query(
    'select public.mcp_update_project($1, 1, null, false, $2) as result',
    [project.id, JSON.stringify({ name: 'Updated project' })],
  )
  assert.equal(updated.rows[0].result.leadId, lead)

  const interaction = await db.query(
    'insert into public.lead_interactions (lead_id) values ($1) returning project_id',
    [lead],
  )
  assert.equal(interaction.rows[0].project_id, project.id)

  const logged = await db.query(
    "select public.mcp_log_work_hours(null, $1, $2, date '2026-11-01', 2, null) as result",
    [lead, member],
  )
  assert.equal(logged.rows[0].result.projectId, project.id)
  const loggedTeam = await db.query(
    "select public.mcp_log_team_work_hours(null, $1, date '2026-11-02', $2, null) as result",
    [lead, JSON.stringify([{ memberId: member, hours: 3 }])],
  )
  assert.equal(loggedTeam.rows[0].result.projectId, project.id)
  const report = await db.query(
    'select public.mcp_get_work_hours(null, $1, null, null, null, null) as result',
    [lead],
  )
  assert.equal(report.rows[0].result.totalHours, 5)

  const {
    rows: [{ result: legacy }],
  } = await create(client, null, 'Legacy client project')
  assert.equal(legacy.leadId, lead)
  const ambiguous = await db.query(
    'select public.mcp_get_work_hours(null, $1, null, null, null, null) as result',
    [lead],
  )
  assert.equal(ambiguous.rows[0].result.status, 'needs_project_selection')
  assert.deepEqual(
    new Set(ambiguous.rows[0].result.projects.map(({ id }) => id)),
    new Set([project.id, legacy.id]),
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await db.close()
}
