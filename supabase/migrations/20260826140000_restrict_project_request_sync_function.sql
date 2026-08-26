-- Trigger helpers are internal implementation details and must not be callable via PostgREST.
revoke all on function public.sync_project_request_from_task()
  from public, anon, authenticated;

notify pgrst, 'reload schema';