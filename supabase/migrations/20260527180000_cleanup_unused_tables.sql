-- ============================================================
-- Cleanup: drop tables with zero usage in the codebase.
-- ============================================================
-- Tables dropped:
--   • email_templates        — table unused; emails built with React Email components.
--   • notification_preferences — no reads or writes anywhere in app/.
--
-- activity_log deliberately remains: later MCP and portal migrations append
-- business audit events to it. Keeping it here also makes a clean migration
-- replay consistent with existing production databases.
-- ============================================================

-- ---- email_templates ----
drop trigger if exists trg_touch_email_templates on public.email_templates;
drop table if exists public.email_templates;

-- ---- notification_preferences ----
drop trigger if exists trg_touch_notification_preferences on public.notification_preferences;
drop index if exists public.idx_notif_prefs_member;
drop table if exists public.notification_preferences;
