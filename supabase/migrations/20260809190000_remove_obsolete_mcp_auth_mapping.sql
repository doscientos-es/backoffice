-- MCP access is now token-gated through RLS; the password-authenticated
-- technical identity is no longer an access path.
delete from public.mcp_service_accounts
where user_id in (
  select id from auth.users where email = 'mcp-reader@doscientos.internal'
);