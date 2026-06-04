-- ============================================================
-- Security fix: per-member calendar subscription token.
--
-- The iCal export at /api/calendar uses the service_role client (bypasses
-- RLS) and previously keyed off the member UUID (`id`). Member UUIDs are not
-- secret (they appear in URLs and other views), so anyone who knew a UUID
-- could read that member's task titles/descriptions without authentication.
--
-- Fix: introduce an unguessable, rotatable `calendar_token` (matches the
-- design in docs/description.md §calendar). The endpoint now resolves the
-- member by this token instead of the public id.
-- ============================================================

alter table public.team_members
  add column if not exists calendar_token text unique
    default encode(gen_random_bytes(24), 'hex');

-- Backfill any pre-existing rows that were created before the default.
update public.team_members
  set calendar_token = encode(gen_random_bytes(24), 'hex')
  where calendar_token is null;
