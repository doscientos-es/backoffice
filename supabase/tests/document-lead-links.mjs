// In-memory fixtures only; no application credentials or production records.
import assert from 'node:assert/strict'

const { PGlite } = await import(process.env.PGLITE_MODULE_PATH)
const db = new PGlite()
await db.exec(`
  create role anon; create role authenticated;
  create table public.leads (id uuid primary key);
  create table public.clients (id uuid primary key, lead_id uuid references public.leads(id));
  create table public.projects (id uuid primary key, client_id uuid not null references public.clients(id));
  create table public.invoices (id uuid primary key, client_id uuid not null references public.clients(id), fiscal_snapshot text not null);
  create table public.subscriptions (id uuid primary key, client_id uuid not null references public.clients(id));
  insert into public.leads values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
  insert into public.clients values
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002');
  insert into public.projects values ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011');
  insert into public.invoices values ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000011', 'immutable');
  insert into public.subscriptions values ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000011');
`)

const migration = `
  lock table public.clients, public.projects, public.invoices, public.subscriptions in share row exclusive mode;
  alter table public.projects add column lead_id uuid references public.leads(id) on delete restrict;
  alter table public.invoices add column lead_id uuid references public.leads(id) on delete restrict;
  alter table public.subscriptions add column lead_id uuid references public.leads(id) on delete restrict;
  update public.projects p set lead_id = c.lead_id from public.clients c where c.id = p.client_id;
  update public.invoices i set lead_id = c.lead_id from public.clients c where c.id = i.client_id;
  update public.subscriptions s set lead_id = c.lead_id from public.clients c where c.id = s.client_id;
  alter table public.projects alter column lead_id set not null;
  alter table public.invoices alter column lead_id set not null;
  alter table public.subscriptions alter column lead_id set not null;
  create index projects_lead_id_idx on public.projects (lead_id);
  create index invoices_lead_id_idx on public.invoices (lead_id);
  create index subscriptions_lead_id_idx on public.subscriptions (lead_id);
  create function public.sync_document_lead_from_client() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare v_lead_id uuid;
  begin
    select lead_id into v_lead_id from public.clients where id = new.client_id for share;
    if v_lead_id is null then raise exception 'Client has no lead'; end if;
    if tg_op = 'UPDATE' and new.client_id is distinct from old.client_id
       and new.lead_id is not distinct from old.lead_id then
      new.lead_id := v_lead_id;
    elsif new.lead_id is null then
      new.lead_id := v_lead_id;
    elsif new.lead_id is distinct from v_lead_id then
      raise exception 'Document lead does not match the billing client';
    end if;
    return new;
  end $$;
  revoke all on function public.sync_document_lead_from_client() from public, anon, authenticated;
  create trigger trg_sync_project_lead before insert or update of client_id, lead_id on public.projects
    for each row execute function public.sync_document_lead_from_client();
  create trigger trg_sync_invoice_lead before insert or update of client_id, lead_id on public.invoices
    for each row execute function public.sync_document_lead_from_client();
  create trigger trg_sync_subscription_lead before insert or update of client_id, lead_id on public.subscriptions
    for each row execute function public.sync_document_lead_from_client();
  create function public.sync_documents_after_client_lead_change() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    if new.lead_id is null then raise exception 'A billing client must have a lead'; end if;
    update public.projects set lead_id = new.lead_id where client_id = new.id and lead_id is distinct from new.lead_id;
    update public.invoices set lead_id = new.lead_id where client_id = new.id and lead_id is distinct from new.lead_id;
    update public.subscriptions set lead_id = new.lead_id where client_id = new.id and lead_id is distinct from new.lead_id;
    return new;
  end $$;
  revoke all on function public.sync_documents_after_client_lead_change() from public, anon, authenticated;
  create trigger trg_sync_documents_after_client_lead_change after update of lead_id on public.clients
    for each row when (old.lead_id is distinct from new.lead_id)
    execute function public.sync_documents_after_client_lead_change();
`
await db.exec(migration)
for (const table of ['projects', 'invoices', 'subscriptions']) {
  const row = (await db.query(`select lead_id from public.${table}`)).rows[0]
  assert.equal(row.lead_id, '00000000-0000-0000-0000-000000000001')
}
await db.exec(`insert into public.projects (id, client_id) values
  ('00000000-0000-0000-0000-000000000024', '00000000-0000-0000-0000-000000000011');`)
assert.equal(
  (
    await db.query(
      `select lead_id from public.projects where id='00000000-0000-0000-0000-000000000024'`,
    )
  ).rows[0].lead_id,
  '00000000-0000-0000-0000-000000000001',
)
await assert.rejects(
  db.exec(
    `update public.projects set lead_id='00000000-0000-0000-0000-000000000002' where id='00000000-0000-0000-0000-000000000024'`,
  ),
)
await db.exec(
  `update public.clients set lead_id='00000000-0000-0000-0000-000000000002' where id='00000000-0000-0000-0000-000000000011'`,
)
for (const table of ['projects', 'invoices', 'subscriptions']) {
  const rows = (await db.query(`select lead_id from public.${table}`)).rows
  assert.ok(rows.every((row) => row.lead_id === '00000000-0000-0000-0000-000000000002'))
}
assert.equal(
  (await db.query('select fiscal_snapshot from public.invoices')).rows[0].fiscal_snapshot,
  'immutable',
)
await assert.rejects(
  db.exec(`update public.clients set lead_id=null where id='00000000-0000-0000-0000-000000000011'`),
)
await db.close()
