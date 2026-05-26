-- ============================================================
-- Remove time tracking — we don't bill by the hour.
-- Drops time_entries entirely and the billable/estimate columns
-- from tasks. tasks.started_at is kept because it tracks when a
-- task moved to 'in_progress' status.
-- ============================================================

drop table if exists public.time_entries cascade;

alter table public.tasks drop column if exists is_billable;
alter table public.tasks drop column if exists estimated_hours;
