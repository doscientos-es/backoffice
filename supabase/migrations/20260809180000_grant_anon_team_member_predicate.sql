-- Existing permissive RLS policies call this boolean helper while evaluating
-- MCP reads. For the anon role it can only return false because auth.uid() is
-- null; execution is required so the MCP SELECT policy can be evaluated.
grant execute on function public.is_team_member() to anon;