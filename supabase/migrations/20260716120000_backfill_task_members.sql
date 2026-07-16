-- Keep the many-to-many assignment relation in sync for tasks created before
-- task_members was introduced. The first assignee remains assignee_id for
-- backwards-compatible ordering and integrations.
INSERT INTO public.task_members (task_id, member_id)
SELECT id, assignee_id
FROM public.tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (task_id, member_id) DO NOTHING;