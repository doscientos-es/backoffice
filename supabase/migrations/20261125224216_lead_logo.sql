-- Keep existing client logos for historical consumers while moving CRM ownership to leads.
alter table public.leads add column if not exists logo_url text;

update public.leads l
set logo_url = c.logo_url
from public.clients c
where c.lead_id = l.id
  and c.deleted_at is null
  and nullif(btrim(c.logo_url), '') is not null
  and nullif(btrim(l.logo_url), '') is null;

notify pgrst, 'reload schema';