-- Permissive RLS policies call this helper while evaluating reads (e.g.
-- internal_documents_select). Without EXECUTE, any anon-role request touching
-- those tables fails with 42501 (permission denied for function) instead of
-- returning no rows — this broke MCP document reads and surfaced as 401s.
-- Mirrors 20260809180000_grant_anon_team_member_predicate.sql (is_team_member).
grant execute on function public.current_member_role() to anon;
