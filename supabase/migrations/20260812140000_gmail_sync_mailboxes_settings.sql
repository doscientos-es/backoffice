-- General Gmail mailboxes supplement the active team-member inboxes that are
-- synchronized into each lead's interaction history.
alter table public.settings
  add column if not exists gmail_sync_mailboxes text[] not null default array['hola@doscientos.es'];