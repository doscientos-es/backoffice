-- MCP read access without a Supabase Auth login or CAPTCHA challenge.
-- The raw token stays in the MCP environment; production stores only its SHA-256 hash.

create table if not exists public.mcp_api_keys (
  token_hash text primary key,
  created_at timestamptz not null default now()
);

alter table public.mcp_api_keys enable row level security;
revoke all on table public.mcp_api_keys from public, anon, authenticated;

create or replace function public.is_mcp_service_account()
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
    select 1 from public.mcp_service_accounts where user_id = auth.uid()
  ) or exists (
    select 1
    from public.mcp_api_keys, request_key
    where token_hash = encode(extensions.digest(request_key.raw_key, 'sha256'), 'hex')
  );
$$;

revoke all on function public.is_mcp_service_account() from public;
grant execute on function public.is_mcp_service_account() to anon, authenticated;

-- This one-time bootstrap RPC is callable only through a service-role JWT.
-- It replaces any prior MCP token, so only one token is active at a time.
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

  delete from public.mcp_api_keys;
  insert into public.mcp_api_keys (token_hash)
  values (encode(extensions.digest(raw_key, 'sha256'), 'hex'));
end;
$$;

revoke all on function public.rotate_mcp_api_key(text) from public;
grant execute on function public.rotate_mcp_api_key(text) to service_role;

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
        'create policy mcp_reader_select on public.%I for select to anon, authenticated using (public.is_mcp_service_account())',
        table_name
      );
    end if;
  end loop;
end $$;