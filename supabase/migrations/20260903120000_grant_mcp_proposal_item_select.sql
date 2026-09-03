-- The MCP proposal reader needs line items to return complete proposal drafts.
-- Keep this read-only and gated by the existing hashed MCP access token.
grant select on table public.proposal_items to anon;

drop policy if exists mcp_reader_select on public.proposal_items;
create policy mcp_reader_select on public.proposal_items
  for select to anon
  using (public.has_valid_mcp_access_token());

notify pgrst, 'reload schema';