-- Dedicated, read-only Supabase Auth identity for the Backoffice MCP.
-- This is additive: existing backoffice policies remain unchanged.

create table if not exists public.mcp_service_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.mcp_service_accounts enable row level security;
revoke all on table public.mcp_service_accounts from anon, authenticated;

create or replace function public.is_mcp_service_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mcp_service_accounts
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_mcp_service_account() from public;
grant execute on function public.is_mcp_service_account() to authenticated;

insert into public.mcp_service_accounts (user_id)
select id from auth.users where email = 'mcp-reader@doscientos.internal'
on conflict (user_id) do nothing;

-- A service account must never satisfy the general is_team_member() write
-- policies. It receives only the explicit SELECT policies defined below.
update public.team_members
set deleted_at = now()
where id in (select user_id from public.mcp_service_accounts)
  and deleted_at is null;

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
        'create policy mcp_reader_select on public.%I for select to authenticated using (public.is_mcp_service_account())',
        table_name
      );
    end if;
  end loop;
end $$;