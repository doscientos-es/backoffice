create table if not exists public.lead_owner_suggestion_states (
  lead_id uuid not null references public.leads(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  state text not null check (state in ('dismissed', 'snoozed')),
  snoozed_until timestamptz,
  updated_by uuid references public.team_members(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (lead_id, member_id),
  check (
    (state = 'snoozed' and snoozed_until is not null)
    or (state = 'dismissed' and snoozed_until is null)
  )
);

create index if not exists lead_owner_suggestion_states_member_idx
  on public.lead_owner_suggestion_states (member_id, state, snoozed_until);

alter table public.lead_owner_suggestion_states enable row level security;
revoke all on public.lead_owner_suggestion_states from anon, authenticated;
grant select, insert, update on public.lead_owner_suggestion_states to authenticated;

create policy lead_owner_suggestion_states_select
  on public.lead_owner_suggestion_states
  for select using (public.can_access_lead(lead_id));

create policy lead_owner_suggestion_states_insert
  on public.lead_owner_suggestion_states
  for insert with check (
    public.can_access_lead(lead_id)
    and public.has_permission('leads.write')
    and (updated_by is null or updated_by = (select auth.uid()))
  );

create policy lead_owner_suggestion_states_update
  on public.lead_owner_suggestion_states
  for update using (public.can_access_lead(lead_id) and public.has_permission('leads.write'))
  with check (
    public.can_access_lead(lead_id)
    and public.has_permission('leads.write')
    and (updated_by is null or updated_by = (select auth.uid()))
  );
