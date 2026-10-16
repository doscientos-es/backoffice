-- Search-only derived values: never rewrite the original contact details.
-- Native Unicode normalization avoids requiring an additional extension.
create function public.normalize_lead_search_text(value text)
returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(normalize(coalesce(value, ''), NFD), U&'[\0300-\036f]', '', 'g'));
$$;

alter table public.leads
  add column search_text text generated always as (
    public.normalize_lead_search_text(
      coalesce(name, '') || ' ' || coalesce(alias, '') || ' ' ||
      coalesce(company, '') || ' ' || coalesce(email::text, '')
    )
  ) stored,
  add column search_phone text generated always as (
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
  ) stored;

comment on column public.leads.search_text is
  'Case- and accent-insensitive name, alias, company and email for lead search.';
comment on column public.leads.search_phone is
  'Digits-only phone for format-independent substring search.';

notify pgrst, 'reload schema';