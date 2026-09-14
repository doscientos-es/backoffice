-- Drive backup metadata for internal documents. The backup itself remains a
-- Drive file; these fields let the app identify its link and freshness.

alter table public.internal_documents
  add column if not exists drive_backup_file_id text,
  add column if not exists drive_backup_url text,
  add column if not exists drive_backup_version int,
  add column if not exists drive_backup_at timestamptz;

alter table public.internal_documents
  drop constraint if exists internal_documents_drive_backup_version_check;

alter table public.internal_documents
  add constraint internal_documents_drive_backup_version_check
  check (drive_backup_version is null or drive_backup_version > 0);