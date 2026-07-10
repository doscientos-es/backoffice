-- proposal_items had RLS enabled but zero policies, which silently blocked
-- all DML for authenticated users (select returned empty, insert/update/delete
-- returned RLS violations). Add the same team-scoped policies as `proposals`.

-- SELECT: any team member can read items for any proposal.
create policy "proposal_items_select"
  on proposal_items for select
  using (is_team_member());

-- INSERT: members (owner/admin/member) can add lines.
create policy "proposal_items_insert"
  on proposal_items for insert
  with check (
    current_member_role() = any (array['owner'::member_role, 'admin'::member_role, 'member'::member_role])
  );

-- UPDATE: same roles as insert.
create policy "proposal_items_update"
  on proposal_items for update
  using (
    current_member_role() = any (array['owner'::member_role, 'admin'::member_role, 'member'::member_role])
  );

-- DELETE: same roles — needed for the atomic delete+insert when editing items.
create policy "proposal_items_delete"
  on proposal_items for delete
  using (
    current_member_role() = any (array['owner'::member_role, 'admin'::member_role, 'member'::member_role])
  );
