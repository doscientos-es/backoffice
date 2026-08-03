-- ============================================================
-- Attachments: support Drive-linked references (source='drive')
-- ============================================================
-- Today every attachment is a copy stored in the `documents` bucket
-- (storage_path). This adds a second kind of attachment: a live reference to
-- a Google Drive file (technical specs, docs written directly in Drive).
-- Drive rows store only metadata (fileId + webViewLink) — nothing is copied
-- into storage, so `storage_path` must become nullable.
--
-- source = 'storage' → existing behavior, storage_path required, drive
--                       columns null.
-- source = 'drive'   → storage_path null, drive_file_id + web_view_link
--                       required. UI opens web_view_link instead of
--                       downloading from the `documents` bucket.
-- ============================================================

alter table public.attachments
  alter column storage_path drop not null;

alter table public.attachments
  add column if not exists source text not null default 'storage',
  add column if not exists drive_file_id text,
  add column if not exists web_view_link text;

alter table public.attachments
  drop constraint if exists attachments_source_check;
alter table public.attachments
  add constraint attachments_source_check check (source in ('storage', 'drive'));

alter table public.attachments
  drop constraint if exists attachments_source_consistency;
alter table public.attachments
  add constraint attachments_source_consistency check (
    (source = 'storage' and storage_path is not null and drive_file_id is null)
    or
    (source = 'drive' and drive_file_id is not null and storage_path is null)
  );
