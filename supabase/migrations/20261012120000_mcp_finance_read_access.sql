-- The MCP finance tools (company financial report, weekly review, client
-- snapshot, anomalies) read expenses and work_logs, but the MCP anon role had
-- neither table-level SELECT nor the token-gated reader policy, so they failed
-- with "permission denied for table expenses". Read-only; no write grants.

do $$
declare table_name text;
begin
  foreach table_name in array array['expenses', 'work_logs'] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('grant select on table public.%I to anon', table_name);
      execute format('drop policy if exists mcp_reader_select on public.%I', table_name);
      execute format(
        'create policy mcp_reader_select on public.%I for select to anon, authenticated using (public.has_valid_mcp_access_token())',
        table_name
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
