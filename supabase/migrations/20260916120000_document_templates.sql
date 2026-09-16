-- ============================================================
-- PDF document templates and generated documents
-- ============================================================

create table if not exists public.document_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  storage_path text not null,
  mime_type    text not null default 'application/pdf',
  size_bytes   bigint not null default 0,
  fields       jsonb not null default '[]'::jsonb,
  version      integer not null default 1,
  is_active    boolean not null default true,
  created_by   uuid references public.team_members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists document_templates_active_idx
  on public.document_templates(is_active, created_at desc)
  where deleted_at is null;

alter table public.document_templates enable row level security;

drop policy if exists "document_templates_select" on public.document_templates;
create policy "document_templates_select" on public.document_templates
  for select using (public.is_team_member());

drop policy if exists "document_templates_insert" on public.document_templates;
create policy "document_templates_insert" on public.document_templates
  for insert with check (public.current_member_role() in ('owner', 'admin'));

drop policy if exists "document_templates_update" on public.document_templates;
create policy "document_templates_update" on public.document_templates
  for update using (public.current_member_role() in ('owner', 'admin'));

drop policy if exists "document_templates_delete" on public.document_templates;
create policy "document_templates_delete" on public.document_templates
  for delete using (public.current_member_role() in ('owner', 'admin'));

drop trigger if exists trg_touch_document_templates on public.document_templates;
create trigger trg_touch_document_templates
  before update on public.document_templates
  for each row execute function public.fn_touch_updated_at();

create table if not exists public.generated_documents (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.document_templates(id) on delete restrict,
  template_version integer not null,
  attachment_id  uuid not null references public.attachments(id) on delete restrict,
  client_id      uuid references public.clients(id) on delete set null,
  project_id     uuid references public.projects(id) on delete set null,
  values         jsonb not null default '{}'::jsonb,
  status         text not null default 'generated'
                 check (status in ('generated', 'sent', 'signed', 'archived')),
  created_by     uuid references public.team_members(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists generated_documents_client_idx
  on public.generated_documents(client_id, created_at desc);
create index if not exists generated_documents_project_idx
  on public.generated_documents(project_id, created_at desc);

alter table public.generated_documents enable row level security;

drop policy if exists "generated_documents_select" on public.generated_documents;
create policy "generated_documents_select" on public.generated_documents
  for select using (public.is_team_member());

drop policy if exists "generated_documents_insert" on public.generated_documents;
create policy "generated_documents_insert" on public.generated_documents
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists "generated_documents_update" on public.generated_documents;
create policy "generated_documents_update" on public.generated_documents
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

notify pgrst, 'reload schema';