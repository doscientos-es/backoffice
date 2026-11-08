-- Metadata-only regression checks; every row must return passed = true.
select 'proposal list uses caller permissions' as test,
  'security_invoker=true' = any(reloptions) as passed
from pg_class where oid = 'public.proposal_list'::regclass
union all
select 'authenticated can query proposal list',
  has_table_privilege('authenticated', 'public.proposal_list', 'SELECT')
union all
select 'anonymous cannot query proposal list',
  not has_table_privilege('anon', 'public.proposal_list', 'SELECT')
union all
select 'anonymous cannot call archive predicate',
  not has_function_privilege('anon', 'public.proposal_is_archived(uuid)', 'EXECUTE')
union all
select 'underlying price column remains restricted',
  not has_column_privilege('authenticated', 'public.proposals', 'total', 'SELECT')
union all
select 'proposal row-level security remains enabled',
  relrowsecurity from pg_class where oid = 'public.proposals'::regclass;