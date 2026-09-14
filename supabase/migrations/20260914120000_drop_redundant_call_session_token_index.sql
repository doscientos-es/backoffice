-- The unique constraint on mobile_token already owns a btree index.
-- Retain it and remove the duplicate non-unique index to avoid duplicate writes.

drop index if exists public.lead_call_sessions_mobile_token_idx;