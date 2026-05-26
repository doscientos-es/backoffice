-- ============================================================
-- Add structured profile fields to team_members:
--   job_title     – e.g. "Co-founder & Software Engineer"
--   phone         – member's phone number (used in email signature)
--   contact_email – public-facing email shown in signature
--                   (defaults to email_alias or auth email)
-- signature_html is now auto-generated from these fields in the app
-- and kept in sync on every profile save.
-- ============================================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS job_title    text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS contact_email text;
