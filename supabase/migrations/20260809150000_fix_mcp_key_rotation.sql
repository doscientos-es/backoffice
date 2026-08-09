-- The production database enforces safe updates, so key rotation needs an
-- explicit predicate even though the table has at most one active key.

create or replace function public.rotate_mcp_api_key(raw_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only service_role may rotate the MCP API key';
  end if;
  if length(raw_key) < 48 then
    raise exception 'MCP API key must be at least 48 characters';
  end if;

  delete from public.mcp_api_keys where token_hash is not null;
  insert into public.mcp_api_keys (token_hash)
  values (encode(extensions.digest(raw_key, 'sha256'), 'hex'));
end;
$$;

revoke all on function public.rotate_mcp_api_key(text) from public, anon, authenticated;
grant execute on function public.rotate_mcp_api_key(text) to service_role;