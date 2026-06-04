-- ============================================================
-- Security fix (defense in depth): the `internal-docs` storage SELECT policy
-- allowed ANY team member to read every object in the bucket, ignoring the
-- `admins_only` visibility enforced at the `internal_documents` table level.
-- A member/viewer who knew/derived a storage_path could read restricted docs
-- by hitting Storage directly.
--
-- Fix: require the matching internal_documents row to be visible to the caller
-- (mirrors internal_documents_select). The happy-path download route uses the
-- service_role admin client (which bypasses RLS) and enforces visibility in
-- app code, so tightening this policy does not break legitimate downloads.
-- ============================================================

drop policy if exists "internal_docs_select" on storage.objects;
create policy "internal_docs_select" on storage.objects
  for select using (
    bucket_id = 'internal-docs'
    and public.is_team_member()
    and exists (
      select 1
      from public.internal_documents d
      where d.storage_path = storage.objects.name
        and d.deleted_at is null
        and (
          d.visibility = 'all_team'
          or public.current_member_role() in ('owner', 'admin')
        )
    )
  );
