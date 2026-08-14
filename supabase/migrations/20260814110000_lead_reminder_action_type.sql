-- Classify lead reminders without conflating their operational action with the
-- lead's commercial pipeline stage. Existing reminders remain unclassified
-- and are treated as generic follow-ups by the application.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS action_type text;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_action_type_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_action_type_check
  CHECK (action_type IS NULL OR action_type IN ('call', 'meeting', 'email', 'follow_up'));

CREATE INDEX IF NOT EXISTS tasks_open_lead_reminder_next_action_idx
  ON public.tasks (lead_id, start_at)
  WHERE kind = 'reminder'
    AND completed_at IS NULL
    AND deleted_at IS NULL;