-- Fix soft-delete failing under RLS ("new row violates row-level security
-- policy") for every soft-deletable table.
--
-- ROOT CAUSE:
--   Soft-delete is an UPDATE that sets `deleted_at`. PostgREST wraps every
--   mutation in `WITH pgrst_source AS (UPDATE ... RETURNING *) SELECT ... FROM
--   pgrst_source`, so the just-updated row is re-read through the table's
--   SELECT policy. Those policies were `(is_team_member() AND deleted_at IS
--   NULL)`, so the post-update row (with `deleted_at` set) failed the SELECT
--   check and the whole statement was rejected.
--
-- FIX:
--   Drop the redundant `deleted_at IS NULL` term from the SELECT policies,
--   keeping the `is_team_member()` tenant/membership scope. Hiding
--   soft-deleted rows from the UI is already handled at the application layer
--   (`lib/supabase/filters.ts` `notDeleted()` + explicit `.is("deleted_at",
--   null)` on every list/detail query), so this clause was pure duplication.
--
-- NOT TOUCHED:
--   storage.objects policies (`documents_select`, `internal_docs_select`)
--   reference `deleted_at` of OTHER tables in an EXISTS subquery. They are not
--   part of this bug (the soft-delete UPDATE is not on storage.objects) and
--   correctly hide files of deleted records, so they stay as-is.

alter policy attachments_select on public.attachments
  using (is_team_member());

alter policy clients_select on public.clients
  using (is_team_member());

alter policy expenses_select on public.expenses
  using (is_team_member());

alter policy invoices_select on public.invoices
  using (is_team_member());

alter policy leads_select on public.leads
  using (is_team_member());

alter policy onboarding_templates_select on public.onboarding_templates
  using (is_team_member());

alter policy project_checklist_items_select on public.project_checklist_items
  using (is_team_member());

alter policy projects_select on public.projects
  using (is_team_member());

alter policy proposals_select on public.proposals
  using (is_team_member());

alter policy subscriptions_select on public.subscriptions
  using (is_team_member());

alter policy tasks_select on public.tasks
  using (is_team_member());

alter policy vault_items_select on public.vault_items
  using (is_team_member());

alter policy web_projects_select on public.web_projects
  using (is_team_member());

alter policy work_logs_select on public.work_logs
  using (is_team_member());

-- internal_documents keeps its visibility gate; only the deleted_at term is
-- removed.
alter policy internal_documents_select on public.internal_documents
  using (
    is_team_member()
    and (
      visibility = 'all_team'
      or current_member_role() = any (array['owner'::member_role, 'admin'::member_role])
    )
  );
