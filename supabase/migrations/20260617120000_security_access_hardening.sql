-- ============================================================
-- Access-control hardening (Broken Access Control / data-leak follow-up)
-- ============================================================
-- Closes the vectors behind the bulk JSON export of business records
-- (including soft-deleted rows) by an authenticated team member hitting
-- PostgREST directly. Three independent layers:
--
--   1. Soft-deleted rows leaked through SELECT policies that only checked
--      is_team_member(). Several tables already filter deleted_at
--      (attachments, internal_documents, onboarding_templates,
--      project_checklist_items, work_logs); the rest did not. Add the
--      `deleted_at IS NULL` filter everywhere a deleted_at column exists,
--      EXCEPT team_members: the team-settings page reads deactivated members
--      via the RLS client to render the "Desactivado" badge and offer
--      reactivation, so that view must keep seeing soft-deleted rows.
--
--   2. marketing_* SELECT policies used `qual = true`, granting every
--      authenticated session unconditional read. Require is_team_member(),
--      matching every other business table. Reads use the RLS server client
--      (lib/marketing/queries.ts); the Meta sync uses the service-role admin
--      client (BYPASSRLS), so it is unaffected. marketing_* hold external
--      Meta data and do not use the soft-delete convention, so no deleted_at
--      filter applies here.
--
--   3. Defense-in-depth role grants. `anon` and `authenticated` both held the
--      full table grant set (incl. TRUNCATE / REFERENCES / TRIGGER) on every
--      public table. RLS already blocks anon (is_team_member() is false with
--      no JWT), but no code path touches these tables as the bare anon role,
--      so revoke all of anon's table/sequence grants outright. Strip the
--      dangerous DDL-adjacent privileges from authenticated while keeping the
--      CRUD set PostgREST needs (SELECT/INSERT/UPDATE/DELETE).
--
-- NOTE: FORCE ROW LEVEL SECURITY is intentionally NOT applied. is_team_member()
-- and current_member_role() are SECURITY DEFINER functions owned by the same
-- role that owns these tables; forcing RLS would subject them to the very
-- policies they back (recursive on team_members) and break auth. No runtime
-- connection uses the table-owner role, and service_role has BYPASSRLS, so
-- forcing would add breakage risk with no real benefit.
-- ============================================================

-- ---------- 1. Hide soft-deleted rows on the remaining SELECT policies ----------
-- Tables with a deleted_at column whose SELECT qual was still bare
-- is_team_member(). team_members is deliberately excluded (see header).
alter policy clients_select       on public.clients       using (public.is_team_member() and deleted_at is null);
alter policy expenses_select      on public.expenses      using (public.is_team_member() and deleted_at is null);
alter policy invoices_select      on public.invoices      using (public.is_team_member() and deleted_at is null);
alter policy leads_select         on public.leads         using (public.is_team_member() and deleted_at is null);
alter policy projects_select      on public.projects      using (public.is_team_member() and deleted_at is null);
alter policy proposals_select     on public.proposals     using (public.is_team_member() and deleted_at is null);
alter policy subscriptions_select on public.subscriptions using (public.is_team_member() and deleted_at is null);
alter policy tasks_select         on public.tasks         using (public.is_team_member() and deleted_at is null);
alter policy vault_items_select   on public.vault_items   using (public.is_team_member() and deleted_at is null);
alter policy web_projects_select  on public.web_projects  using (public.is_team_member() and deleted_at is null);

-- ---------- 2. Restrict marketing reads to team members ----------
-- The original policy was named "Allow authenticated users to read marketing
-- data" with qual = true. Replace it with a conventionally named, scoped one.
drop policy if exists "Allow authenticated users to read marketing data" on public.marketing_campaigns;
drop policy if exists "Allow authenticated users to read marketing data" on public.marketing_ad_sets;
drop policy if exists "Allow authenticated users to read marketing data" on public.marketing_ads;
drop policy if exists "Allow authenticated users to read marketing data" on public.marketing_insights;

create policy marketing_campaigns_select on public.marketing_campaigns
  for select using (public.is_team_member());
create policy marketing_ad_sets_select on public.marketing_ad_sets
  for select using (public.is_team_member());
create policy marketing_ads_select on public.marketing_ads
  for select using (public.is_team_member());
create policy marketing_insights_select on public.marketing_insights
  for select using (public.is_team_member());

-- ---------- 3. Tighten role grants ----------
-- anon: no legitimate code path reads/writes public tables as the bare anon
-- role (browser client carries the session JWT -> authenticated; public
-- portals/webhooks use the service-role client). Revoke everything.
revoke all privileges on all tables    in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

-- authenticated: keep the CRUD set PostgREST needs, drop the rest.
revoke truncate, references, trigger on all tables in schema public from authenticated;
