-- Metadata-only regression checks; every row must return passed = true.
select 'authenticated can read demo_url' as test,
  has_column_privilege('authenticated', 'public.proposals', 'demo_url', 'SELECT') as passed
union all
select 'price column stays restricted',
  not has_column_privilege('authenticated', 'public.proposals', 'total', 'SELECT')
union all
select 'proposal row-level security remains enabled',
  relrowsecurity from pg_class where oid = 'public.proposals'::regclass;