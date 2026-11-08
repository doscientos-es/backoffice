-- Allow the MCP token to inspect only the archive state of its own accessible
-- proposals, while keeping the existing checks for authenticated team members.
create or replace function public.proposal_is_archived(uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.proposals p
    left join public.clients c on c.id = p.client_id
    join public.leads l on l.id = coalesce(p.lead_id, c.lead_id)
    where p.id = $1
      and p.deleted_at is null
      and (public.can_access_proposal(p.id) or public.has_valid_mcp_access_token())
      and l.status = 'archived'
  )
$$;

grant execute on function public.proposal_is_archived(uuid) to anon;

-- The MCP role can read all proposal columns, so PostgREST can pass the row to
-- a computed field. The backoffice continues using its restricted invoker view.
create or replace function public.mcp_proposal_is_archived(public.proposals)
returns boolean
language sql stable
set search_path = public, pg_temp
as $$ select public.proposal_is_archived($1.id) $$;

revoke all on function public.mcp_proposal_is_archived(public.proposals) from public, authenticated;
grant execute on function public.mcp_proposal_is_archived(public.proposals) to anon;

notify pgrst, 'reload schema';