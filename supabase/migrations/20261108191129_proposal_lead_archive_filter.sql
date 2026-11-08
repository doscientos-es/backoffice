-- The archive state is derived from the proposal's lead, including the lead
-- behind a client. Do not expose the lead itself to proposal-only roles.
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
      and public.can_access_proposal(p.id)
      and l.status = 'archived'
  )
$$;

revoke all on function public.proposal_is_archived(uuid) from public, anon;
grant execute on function public.proposal_is_archived(uuid) to authenticated;

-- Passing a whole proposal to a computed field requires permission on its
-- restricted price columns. This invoker view keeps proposal RLS in force and
-- exposes the archive state without requiring those permissions.
create view public.proposal_list with (security_invoker = true) as
  select p.id, p.number, p.title, p.status, p.delivered_at, p.valid_until,
    p.sent_at, p.viewed_at, p.responded_at, p.client_id, p.lead_id, p.project_id,
    p.created_at, p.deleted_at,
    (select prices.total from public.proposal_prices prices where prices.proposal_id = p.id) as total,
    public.proposal_is_archived(p.id) as is_archived
  from public.proposals p;

revoke all on public.proposal_list from public, anon;
grant select on public.proposal_list to authenticated;

notify pgrst, 'reload schema';