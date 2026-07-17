-- ============================================================
-- Team members assigned to a proposal/project preview
-- ============================================================

create table if not exists public.proposal_team_members (
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  member_id uuid not null references public.team_members(id) on delete cascade,
  position int not null default 0,
  primary key (proposal_id, member_id)
);

create index if not exists proposal_team_members_proposal_idx
  on public.proposal_team_members(proposal_id, position);

alter table public.proposal_team_members enable row level security;

drop policy if exists proposal_team_members_select on public.proposal_team_members;
create policy proposal_team_members_select on public.proposal_team_members
  for select using (public.is_team_member());

drop policy if exists proposal_team_members_insert on public.proposal_team_members;
create policy proposal_team_members_insert on public.proposal_team_members
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists proposal_team_members_update on public.proposal_team_members;
create policy proposal_team_members_update on public.proposal_team_members
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists proposal_team_members_delete on public.proposal_team_members;
create policy proposal_team_members_delete on public.proposal_team_members
  for delete using (public.current_member_role() in ('owner','admin','member'));