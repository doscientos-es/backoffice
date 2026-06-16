-- Fix team_members RLS policies
--
-- BEFORE:
--   INSERT → no WITH CHECK clause (any authenticated user could insert rows)
--   UPDATE → `(owner/admin) OR (id = auth.uid())` — self-update allowed members
--             to escalate their own role to 'owner' via direct API call.
--
-- AFTER:
--   INSERT policy removed entirely. The only legitimate inserts come from:
--     · handle_new_user trigger (SECURITY DEFINER, bypasses RLS)
--     · inviteTeamMember server action (admin client, bypasses RLS)
--   UPDATE restricted to owner/admin only. deactivateMember / updateMemberRole
--     server actions enforce role checks at the application layer before reaching
--     the database; reactivateMember already used the admin client.

drop policy if exists team_members_insert on public.team_members;

drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update to authenticated
  using (current_member_role() = any (array['owner'::member_role, 'admin'::member_role]));
