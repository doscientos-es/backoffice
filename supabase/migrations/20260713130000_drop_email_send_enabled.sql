-- ============================================================
-- Drop email_send_enabled column from team_members.
-- Email sending is now considered always active for all
-- onboarded team members.
-- ============================================================

ALTER TABLE public.team_members
  DROP COLUMN IF EXISTS email_send_enabled;
