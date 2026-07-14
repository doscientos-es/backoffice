-- Feature: merge calendar events into tasks table + multi-member assignment
--
-- 1. Add kind + event-scheduling columns to tasks
-- 2. Relax project/lead constraint so events don't need one
-- 3. Create task_members (many-to-many) for events AND task collaborators
-- 4. Migrate existing events / event_attendees into the new model

-- ─── 1. New columns on tasks ──────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kind     text        NOT NULL DEFAULT 'task'
    CHECK (kind IN ('task', 'event')),
  ADD COLUMN IF NOT EXISTS start_at  timestamptz,
  ADD COLUMN IF NOT EXISTS end_at    timestamptz,
  ADD COLUMN IF NOT EXISTS all_day   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location  text;

-- ─── 2. Relax context check so events need no project / lead ─────────────────
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_context_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_context_check CHECK (
    kind = 'event' OR project_id IS NOT NULL OR lead_id IS NOT NULL
  );

-- ─── 3. task_members (many-to-many) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.task_members (
  task_id   uuid NOT NULL REFERENCES public.tasks(id)        ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, member_id)
);

CREATE INDEX IF NOT EXISTS task_members_task_idx   ON public.task_members(task_id);
CREATE INDEX IF NOT EXISTS task_members_member_idx ON public.task_members(member_id);

ALTER TABLE public.task_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_members_select ON public.task_members;
CREATE POLICY task_members_select ON public.task_members
  FOR SELECT USING (public.is_team_member());

DROP POLICY IF EXISTS task_members_insert ON public.task_members;
CREATE POLICY task_members_insert ON public.task_members
  FOR INSERT WITH CHECK (public.is_team_member());

DROP POLICY IF EXISTS task_members_delete ON public.task_members;
CREATE POLICY task_members_delete ON public.task_members
  FOR DELETE USING (public.is_team_member());

-- ─── 4. Migrate existing events → tasks ──────────────────────────────────────
INSERT INTO public.tasks (
  id, kind, title, description, start_at, end_at, all_day, location,
  created_by, created_at, updated_at, deleted_at,
  kanban_order, status, priority
)
SELECT
  e.id,
  'event',
  e.title,
  e.description,
  e.start_at,
  e.end_at,
  e.all_day,
  e.location,
  e.created_by,
  e.created_at,
  e.updated_at,
  e.deleted_at,
  'a0',
  'todo',
  'medium'
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t WHERE t.id = e.id
);

-- ─── 5. Migrate event_attendees → task_members ───────────────────────────────
INSERT INTO public.task_members (task_id, member_id)
SELECT ea.event_id, ea.member_id
FROM public.event_attendees ea
WHERE EXISTS (
  SELECT 1 FROM public.tasks t WHERE t.id = ea.event_id AND t.kind = 'event'
)
ON CONFLICT DO NOTHING;
