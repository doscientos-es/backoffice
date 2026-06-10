-- ============================================================
-- Harden RLS for attachments + the `documents` storage bucket.
-- ============================================================
-- Two defense-in-depth fixes, consistent with the existing access model
-- (all team members may read business records) and mirroring the internal-docs
-- hardening in 20260604100100_fix_internal_docs_storage_select.sql.
--
-- NOTE: this intentionally does NOT scope attachments by lead owner
-- (leads.assigned_to). The whole app lets any team member read every lead /
-- project / proposal, and projects/proposals/clients have no owner column, so
-- per-owner isolation would be inconsistent and impossible to apply uniformly.
--
--   1. attachments_select did not exclude soft-deleted rows, so deleted
--      attachments stayed visible. internal_documents_select already filters
--      deleted_at; apply the same filter here.
--
--   2. documents_select on storage.objects let ANY team member read ANY object
--      in the bucket by path — even with no matching attachments row, or a
--      soft-deleted one. Require a live attachments row whose storage_path
--      matches. The happy-path download route uses the service_role admin
--      client (RLS bypassed) and filters deleted_at in app code, so legitimate
--      downloads are unaffected.
-- ============================================================

-- ---- 1. attachments table: hide soft-deleted rows ----
drop policy if exists "attachments_select" on public.attachments;
create policy "attachments_select" on public.attachments
  for select using (
    public.is_team_member() and deleted_at is null
  );

-- ---- 2. documents bucket: require a live matching attachments row ----
drop policy if exists "documents_select" on storage.objects;
create policy "documents_select" on storage.objects
  for select using (
    bucket_id = 'documents'
    and public.is_team_member()
    and exists (
      select 1
      from public.attachments a
      where a.storage_path = storage.objects.name
        and a.deleted_at is null
    )
  );
