-- Ensure PostgREST includes this table in its schema cache for signed-in users.
grant select, insert, delete on public.project_team_members to authenticated;

notify pgrst, 'reload schema';
