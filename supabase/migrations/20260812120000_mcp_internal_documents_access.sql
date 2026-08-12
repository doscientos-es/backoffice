-- Give the token-gated MCP read-only access to team-visible document metadata.
-- The MCP has no per-user identity, so admin-only documents intentionally stay
-- out of its scope and must be opened from the authenticated backoffice.

grant select on table public.internal_documents to anon, authenticated;

drop policy if exists mcp_reader_select on public.internal_documents;
create policy mcp_reader_select on public.internal_documents
  for select to anon, authenticated
  using (
    public.has_valid_mcp_access_token()
    and deleted_at is null
    and visibility = 'all_team'
  );

-- Storage access must mirror the document visibility; knowing an object path
-- must never bypass an admins_only document's RLS policy.
drop policy if exists "internal_docs_select" on storage.objects;
create policy "internal_docs_select" on storage.objects
  for select using (
    bucket_id = 'internal-docs'
    and public.is_team_member()
    and exists (
      select 1
      from public.internal_documents
      where internal_documents.storage_path = storage.objects.name
        and internal_documents.deleted_at is null
        and (
          internal_documents.visibility = 'all_team'
          or public.current_member_role() in ('owner', 'admin')
        )
    )
  );