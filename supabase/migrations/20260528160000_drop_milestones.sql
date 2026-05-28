-- Drop all milestone-related schema artefacts.
-- Tasks become standalone (no milestone link). The Kanban replaces the
-- milestone planning concept.

-- 1. Trigger + function that recalculated milestone progress on task changes.
drop trigger if exists trg_milestone_progress on public.tasks;
drop function if exists public.update_milestone_progress();

-- 2. RLS policies on milestones (drop before the table to be explicit).
drop policy if exists milestones_select on public.milestones;
drop policy if exists milestones_insert on public.milestones;
drop policy if exists milestones_update on public.milestones;
drop policy if exists milestones_delete on public.milestones;

-- 3. Remove the FK column from tasks.
alter table public.tasks drop column if exists milestone_id;

-- 4. Drop the milestones table itself (cascade to indexes/constraints).
drop table if exists public.milestones cascade;
