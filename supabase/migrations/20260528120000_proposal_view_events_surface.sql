-- ============================================================
-- Add `surface` to proposal_view_events
-- ============================================================
-- We track two public surfaces per proposal:
--   - 'portal' → written proposal at /p/proposal/[token]
--   - 'deck'   → presentation at /deck/[token]
-- Distinguishing them lets the proposal detail page show, per
-- surface, whether the client has opened it and when.
-- Slide-level events stay scoped to surface='deck'.
-- ============================================================

alter table public.proposal_view_events
  add column if not exists surface text not null default 'portal'
  check (surface in ('portal', 'deck'));

-- Backfill: any pre-existing row with slide-level data was a deck event.
update public.proposal_view_events
   set surface = 'deck'
 where surface = 'portal'
   and (session_id is not null or slide_key is not null);

create index if not exists proposal_view_events_surface_idx
  on public.proposal_view_events(proposal_id, surface, viewer_type, viewed_at desc);
