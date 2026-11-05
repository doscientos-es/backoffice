-- Each contact has a private, stable unsubscribe link independent of any send.
alter table public.email_marketing_contacts
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

create unique index if not exists email_marketing_contacts_unsubscribe_token_uidx
  on public.email_marketing_contacts (unsubscribe_token);

-- Preserve historical opt-outs, including emails sent before marketing contacts existed.
insert into public.email_marketing_contacts (email, status, unsubscribed_at)
select lower(trim(email)), 'unsubscribed', min(unsubscribed_at)
from public.lead_campaign_sends
where unsubscribed_at is not null and nullif(trim(email), '') is not null
group by lower(trim(email))
on conflict do nothing;

update public.email_marketing_contacts as contact
set status = 'unsubscribed', unsubscribed_at = coalesce(contact.unsubscribed_at, opt_out.at)
from (
  select lower(trim(email)) as email, min(unsubscribed_at) as at
  from public.lead_campaign_sends
  where unsubscribed_at is not null and nullif(trim(email), '') is not null
  group by lower(trim(email))
) as opt_out
where lower(trim(contact.email)) = opt_out.email and contact.status = 'subscribed';