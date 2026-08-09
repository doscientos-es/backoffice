-- Supabase assigns direct EXECUTE defaults to anon/authenticated.
-- Revoke them explicitly: the bootstrap RPC is service-role-only.

revoke all on function public.rotate_mcp_api_key(text) from public, anon, authenticated;
grant execute on function public.rotate_mcp_api_key(text) to service_role;

-- The RLS predicate itself must remain callable by both API roles.
revoke all on function public.is_mcp_service_account() from public, anon, authenticated;
grant execute on function public.is_mcp_service_account() to anon, authenticated;