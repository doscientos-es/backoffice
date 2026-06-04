-- ============================================================
-- Security + RLS performance hardening
-- ============================================================
-- Addresses Supabase advisor findings without changing behaviour
-- for authenticated users:
--   1. Mutable search_path on trigger functions.
--   2. SECURITY DEFINER helpers / trigger fn exposed to anon via RPC.
--   3. RLS policies re-evaluating auth.uid() per row (init-plan).
--   4. Duplicate permissive UPDATE policies on team_members.

-- ---------- 1. Fix mutable search_path on trigger functions ----------
alter function public.fn_touch_updated_at() set search_path = public;
alter function public.fn_invoice_immutable() set search_path = public;
alter function public.fn_invoice_items_immutable() set search_path = public;

-- ---------- 2. Harden function exposure ----------
-- Functions are granted EXECUTE to PUBLIC by default, which leaks to both
-- `anon` and `authenticated` via PostgREST RPC. Revoking only those roles is
-- not enough while the PUBLIC grant stands, so revoke PUBLIC explicitly.
--
-- handle_new_user is a trigger fired by auth.users inserts; triggers run
-- regardless of EXECUTE grants, so it needs no role grant at all.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- current_member_role / is_team_member back RLS, so signed-in users MUST keep
-- EXECUTE; we drop the PUBLIC (anon) leak and grant `authenticated` explicitly.
-- Public portals use the service-role client (RLS bypassed), so anon never
-- invokes these helpers in a legitimate flow.
revoke execute on function public.current_member_role() from public, anon, authenticated;
grant execute on function public.current_member_role() to authenticated;
revoke execute on function public.is_team_member() from public, anon, authenticated;
grant execute on function public.is_team_member() to authenticated;

-- ---------- 3. RLS init-plan: wrap auth.uid() in a scalar sub-query ----------
-- notifications (recipient-scoped)
alter policy notifications_select on public.notifications
  using (recipient_id = (select auth.uid()));
alter policy notifications_update on public.notifications
  using (recipient_id = (select auth.uid()));
alter policy notifications_delete on public.notifications
  using (recipient_id = (select auth.uid()));

-- notification_preferences (member-scoped, ALL)
alter policy notif_prefs_all on public.notification_preferences
  using (member_id = (select auth.uid()))
  with check (member_id = (select auth.uid()));

-- ---------- 4. Consolidate team_members UPDATE policies ----------
-- Two permissive UPDATE policies (admin + self) are merged into one so the
-- planner evaluates a single qual per row; auth.uid() is wrapped for the
-- init-plan win.
--
-- The WITH CHECK closes a privilege-escalation hole: without it, PostgreSQL
-- reuses the USING qual to validate the resulting row, so a self-updating
-- member/viewer could set their own `role` to 'owner'/'admin'. Owners/admins
-- keep full control; everyone else may update their own row only as long as
-- the role column is left unchanged (equals their current role).
drop policy if exists team_members_update_admin on public.team_members;
drop policy if exists team_members_update_self on public.team_members;
drop policy if exists team_members_update on public.team_members;
create policy team_members_update on public.team_members
  for update using (
    public.current_member_role() in ('owner', 'admin')
    or id = (select auth.uid())
  )
  with check (
    public.current_member_role() in ('owner', 'admin')
    or role = public.current_member_role()
  );
