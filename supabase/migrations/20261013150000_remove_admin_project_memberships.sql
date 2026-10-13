-- Owners and administrators have global project access, so no explicit
-- collaborator rows are needed for them.
delete from public.project_team_members ptm
using public.team_members tm
where tm.id = ptm.member_id
  and tm.role in ('owner', 'admin');
