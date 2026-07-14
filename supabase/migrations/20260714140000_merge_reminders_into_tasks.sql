-- Feature: merge reminders into tasks table + add client_id + allow free-floating tasks
--
-- 1. Add client_id to tasks
-- 2. Update kind CHECK to include 'reminder'
-- 3. Drop strict context constraint → tasks can be personal (no project/lead/client)
-- 4. Migrate existing reminders into tasks with kind='reminder'

-- ─── 1. Add client_id ────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_client_idx ON public.tasks(client_id) WHERE deleted_at IS NULL;

-- ─── 2. Expand kind enum ──────────────────────────────────────────────────────
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_kind_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_kind_check CHECK (kind IN ('task', 'event', 'reminder'));

-- ─── 3. Relax context constraint — allow personal/free tasks ─────────────────
-- Tasks can now be linked to project, lead, client, or none (personal tasks).
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_context_check;

-- ─── 4. Migrate existing reminders → tasks ───────────────────────────────────
INSERT INTO public.tasks (
  id, kind, title, description,
  start_at, completed_at,
  lead_id, client_id, project_id,
  created_by, created_at, updated_at,
  -- required non-null defaults
  status, priority, all_day, is_billable
)
SELECT
  r.id,
  'reminder',
  r.title,
  r.notes,
  r.remind_at,          -- remind_at maps to start_at
  r.completed_at,
  r.lead_id,
  r.client_id,
  r.project_id,
  r.created_by,
  r.created_at,
  r.created_at,         -- no updated_at on reminders, use created_at
  'todo',
  'medium',
  false,
  false
FROM public.reminders r
WHERE NOT EXISTS (
  SELECT 1 FROM public.tasks t WHERE t.id = r.id
);
