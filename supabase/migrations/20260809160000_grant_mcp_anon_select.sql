-- The MCP uses the API's anon role with a token-gated RLS policy.
-- Granting table-level SELECT lets RLS evaluate that policy; no write grants
-- are given.

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
      execute format('grant select on table public.%I to anon', table_name);
    end if;
  end loop;
end $$;