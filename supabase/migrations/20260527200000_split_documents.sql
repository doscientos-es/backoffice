-- ============================================================
-- Split documents → attachments + proposal_specs
-- ============================================================
-- Before: one documents table mixing uploaded files (kind='file')
--         and editable markdown specs (kind='technical_spec').
-- After:
--   • attachments     — uploaded files linked to client/project/lead/proposal.
--   • proposal_specs  — markdown specs with public portal token.
-- ============================================================

-- ---- attachments ----
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  mime_type    text,
  size_bytes   bigint,
  storage_path text not null,
  client_id    uuid references public.clients(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  lead_id      uuid references public.leads(id) on delete set null,
  proposal_id  uuid references public.proposals(id) on delete set null,
  uploaded_by  uuid references public.team_members(id) on delete set null,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists attachments_client_idx  on public.attachments(client_id)  where deleted_at is null;
create index if not exists attachments_project_idx on public.attachments(project_id) where deleted_at is null;

alter table public.attachments enable row level security;

drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments
  for select using (public.is_team_member());

drop policy if exists "attachments_insert" on public.attachments;
create policy "attachments_insert" on public.attachments
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "attachments_update" on public.attachments;
create policy "attachments_update" on public.attachments
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "attachments_delete" on public.attachments;
create policy "attachments_delete" on public.attachments
  for delete using (public.current_member_role() in ('owner','admin'));

drop trigger if exists trg_touch_attachments on public.attachments;
create trigger trg_touch_attachments
  before update on public.attachments
  for each row execute function public.fn_touch_updated_at();

-- ---- proposal_specs ----
create table if not exists public.proposal_specs (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  body_markdown     text not null,
  is_client_visible boolean not null default false,
  portal_token      text unique default encode(gen_random_bytes(24), 'hex'),
  proposal_id       uuid not null references public.proposals(id) on delete cascade,
  project_id        uuid references public.projects(id) on delete set null,
  client_id         uuid references public.clients(id) on delete set null,
  created_by        uuid references public.team_members(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists proposal_specs_proposal_idx
  on public.proposal_specs(proposal_id);

create index if not exists proposal_specs_portal_token_idx
  on public.proposal_specs(portal_token)
  where portal_token is not null;

alter table public.proposal_specs enable row level security;

drop policy if exists "proposal_specs_select" on public.proposal_specs;
create policy "proposal_specs_select" on public.proposal_specs
  for select using (public.is_team_member());

drop policy if exists "proposal_specs_insert" on public.proposal_specs;
create policy "proposal_specs_insert" on public.proposal_specs
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "proposal_specs_update" on public.proposal_specs;
create policy "proposal_specs_update" on public.proposal_specs
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "proposal_specs_delete" on public.proposal_specs;
create policy "proposal_specs_delete" on public.proposal_specs
  for delete using (public.current_member_role() in ('owner','admin','member'));

drop trigger if exists trg_touch_proposal_specs on public.proposal_specs;
create trigger trg_touch_proposal_specs
  before update on public.proposal_specs
  for each row execute function public.fn_touch_updated_at();

-- ---- Migrate existing data ----
insert into public.attachments
  (id, name, mime_type, size_bytes, storage_path,
   client_id, project_id, lead_id, uploaded_by, created_at)
select id, name, mime_type, size_bytes, storage_path,
       client_id, project_id, lead_id, uploaded_by, created_at
from public.documents
where kind = 'file' or kind is null
on conflict (id) do nothing;

insert into public.proposal_specs
  (id, title, body_markdown, is_client_visible, portal_token,
   proposal_id, project_id, client_id, created_by, created_at, updated_at)
select id, coalesce(title, name), body_markdown, is_client_visible, portal_token,
       proposal_id, project_id, client_id, uploaded_by, created_at, updated_at
from public.documents
where kind = 'technical_spec'
on conflict (id) do nothing;

-- ---- Drop superseded table + related objects ----
drop trigger if exists trg_touch_documents on public.documents;
drop index if exists public.documents_proposal_idx;
drop index if exists public.documents_kind_idx;
drop index if exists public.documents_portal_token_idx;
drop table if exists public.documents;
