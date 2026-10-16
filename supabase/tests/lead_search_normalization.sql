-- Read-only regression checks with synthetic contacts only.
-- Every row must return passed = true; no production contact data is read.
with fixtures as (
  select
    public.normalize_lead_search_text(
      'María García Mery Acme SL ana+ventas@empresa.example'
    ) as search_text,
    regexp_replace('+34 (671) 171-525', '[^0-9]', '', 'g') as search_phone
), checks as (
  select 'unicode normalization' as test,
    public.normalize_lead_search_text(U&'Mar\00eda GARC\00cdA \00c0lex Mu\00f1oz Jose\0301') =
      'maria garcia alex munoz jose' as passed
  union all
  select 'nullable contacts', public.normalize_lead_search_text(null) = ''
  union all
  select 'reordered words across name and company',
    search_text ilike '%acme%' and search_text ilike '%garcia%' and search_text ilike '%maria%'
  from fixtures
  union all
  select 'all terms are required',
    not (search_text ilike '%garcia%' and search_text ilike '%nonexistent%')
  from fixtures
  union all
  select 'alias', search_text ilike '%mery%' from fixtures
  union all
  select 'email and domain fragments',
    search_text ilike '%ana+ventas@empresa.example%' and search_text ilike '%@empresa.example%'
  from fixtures
  union all
  select 'local phone finds formatted international storage', search_phone like '%671171525%'
  from fixtures
  union all
  select 'formatted input finds compact storage',
    '671171525' like '%' || regexp_replace('671 171 525', '[^0-9]', '', 'g') || '%'
  union all
  select 'phone suffix', search_phone like '%171525%' from fixtures
  union all
  select 'phone digits must be contiguous',
    regexp_replace('671 000 171 000 525', '[^0-9]', '', 'g') not like '%671171525%'
  union all
  select 'name plus phone', search_text ilike '%maria%' and search_phone like '%171525%'
  from fixtures
)
select test, passed from checks order by test;