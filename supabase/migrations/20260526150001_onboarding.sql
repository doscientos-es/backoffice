-- ============================================================
-- Onboarding: track when a team_member completes the first-run
-- setup flow. NULL means "still pending"; the app redirects such
-- users to /onboarding before granting access to /(app)/*.
-- ============================================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;
