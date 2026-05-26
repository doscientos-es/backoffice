-- ============================================================
-- Internal company documents (policies, HR, legal, templates…)
-- Separate from client/project attachments (public.documents).
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'internal_doc_category') then
    create type public.internal_doc_category as enum (
      'legal', 'hr', 'finance', 'templates', 'policies', 'meetings', 'other'
    );
  end if;
end$$;

create table if not exists public.internal_documents (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  category         public.internal_doc_category not null default 'other',
  mime_type        text,
  size_bytes       bigint,
  storage_path     text not null,
  checksum_sha256  text,
  version          int not null default 1,
  replaces_id      uuid references public.internal_documents(id) on delete set null,
  tags             text[] not null default '{}',
  effective_date   date,
  expires_at       date,
  -- 'admins_only' restricts read to owner/admin at the RLS level
  visibility       text not null default 'all_team'
                   check (visibility in ('all_team', 'admins_only')),
  uploaded_by      uuid references public.team_members(id) on delete set null,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists internal_documents_category_idx
  on public.internal_documents(category) where deleted_at is null;

create index if not exists internal_documents_expires_idx
  on public.internal_documents(expires_at)
  where deleted_at is null and expires_at is not null;

-- ---- RLS ----
alter table public.internal_documents enable row level security;

drop policy if exists internal_documents_select on public.internal_documents;
create policy internal_documents_select on public.internal_documents
  for select using (
    public.is_team_member()
    and deleted_at is null
    and (
      visibility = 'all_team'
      or public.current_member_role() in ('owner','admin')
    )
  );

drop policy if exists internal_documents_insert on public.internal_documents;
create policy internal_documents_insert on public.internal_documents
  for insert with check (
    public.current_member_role() in ('owner','admin','member')
  );

drop policy if exists internal_documents_update on public.internal_documents;
create policy internal_documents_update on public.internal_documents
  for update using (
    public.current_member_role() in ('owner','admin','member')
  );

drop policy if exists internal_documents_delete on public.internal_documents;
create policy internal_documents_delete on public.internal_documents
  for delete using (
    public.current_member_role() in ('owner','admin')
  );

-- updated_at trigger
drop trigger if exists trg_touch_internal_documents on public.internal_documents;
create trigger trg_touch_internal_documents
  before update on public.internal_documents
  for each row execute function public.fn_touch_updated_at();

-- ---- Storage bucket ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'internal-docs', 'internal-docs', false,
  52428800, -- 50 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png', 'image/jpeg',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

-- ---- Storage policies ----
drop policy if exists "internal_docs_select" on storage.objects;
create policy "internal_docs_select" on storage.objects
  for select using (
    bucket_id = 'internal-docs' and public.is_team_member()
  );

drop policy if exists "internal_docs_insert" on storage.objects;
create policy "internal_docs_insert" on storage.objects
  for insert with check (
    bucket_id = 'internal-docs'
    and public.current_member_role() in ('owner','admin','member')
  );

drop policy if exists "internal_docs_delete" on storage.objects;
create policy "internal_docs_delete" on storage.objects
  for delete using (
    bucket_id = 'internal-docs'
    and public.current_member_role() in ('owner','admin')
  );
