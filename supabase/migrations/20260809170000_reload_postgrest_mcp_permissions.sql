-- Refresh PostgREST's schema and privilege cache after granting anon SELECT.
notify pgrst, 'reload schema';