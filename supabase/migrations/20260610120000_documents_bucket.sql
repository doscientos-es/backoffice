-- ============================================================
-- Create the `documents` storage bucket for generic attachments.
-- ============================================================
-- The `attachments` table (see 20260527200000_split_documents.sql) stores
-- files linked to leads/projects/proposals/clients, and both the upload route
-- (app/api/attachments/upload) and download route (app/api/documents/[id]/download)
-- read/write the `documents` bucket. That bucket was never created in a
-- migration, causing "Bucket not found" on upload. This migration creates it
-- with the same constraints as `internal-docs` (private, 50 MB, same MIME set).
-- ============================================================

-- ---- Storage bucket ----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false,
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
-- The happy-path upload/download routes use the service_role admin client
-- (which bypasses RLS) and enforce access in app code. These policies are
-- defense in depth, mirroring the `attachments` table access rules.
drop policy if exists "documents_select" on storage.objects;
create policy "documents_select" on storage.objects
  for select using (
    bucket_id = 'documents' and public.is_team_member()
  );

drop policy if exists "documents_insert" on storage.objects;
create policy "documents_insert" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.current_member_role() in ('owner','admin','member')
  );

drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.current_member_role() in ('owner','admin')
  );
