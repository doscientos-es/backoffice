-- ============================================================
-- Cleanup: drop tables with zero usage in the codebase.
-- ============================================================
-- Tables dropped:
--   • activity_log           — never read/written; logging is handled by pino stdout.
--   • email_templates        — table unused; emails built with React Email components.
--   • notification_preferences — no reads or writes anywhere in app/.
-- ============================================================

-- ---- activity_log ----
drop index if exists public.activity_log_entity_idx;
drop table if exists public.activity_log;

-- ---- email_templates ----
drop trigger if exists trg_touch_email_templates on public.email_templates;
drop table if exists public.email_templates;

-- ---- notification_preferences ----
drop trigger if exists trg_touch_notification_preferences on public.notification_preferences;
drop index if exists public.idx_notif_prefs_member;
drop table if exists public.notification_preferences;
