-- Final cleanup of the abandoned password-authenticated MCP design.
-- MCP access is exclusively a hashed token carried in X-MCP-API-Key.

create or replace function public.has_valid_mcp_access_token()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  with request_key as (
    select nullif(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-mcp-api-key',
      ''
    ) as raw_key
  )
  select exists (
    select 1
    from public.mcp_api_keys, request_key
    where token_hash = encode(extensions.digest(request_key.raw_key, 'sha256'), 'hex')
  );
$$;

revoke all on function public.has_valid_mcp_access_token() from public, anon, authenticated;
grant execute on function public.has_valid_mcp_access_token() to anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'settings', 'team_members', 'leads', 'lead_interactions', 'clients',
    'projects', 'proposals', 'invoices', 'invoice_items', 'tasks',
    'attachments', 'milestones', 'project_checklist_items',
    'marketing_campaigns', 'marketing_ad_sets', 'marketing_ads',
    'marketing_insights'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop policy if exists mcp_reader_select on public.%I', table_name);
      execute format(
        'create policy mcp_reader_select on public.%I for select to anon, authenticated using (public.has_valid_mcp_access_token())',
        table_name
      );
    end if;
  end loop;
end $$;

drop function public.is_mcp_service_account();
drop table public.mcp_service_accounts;
delete from auth.users where email = 'mcp-reader@doscientos.internal';

notify pgrst, 'reload schema';