-- Gmail-originated lead interactions retain provider identifiers so a manual
-- sync can safely be retried without duplicating the timeline.
alter table public.lead_interactions
  add column if not exists gmail_mailbox text,
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text,
  add column if not exists gmail_rfc_message_id text;

create unique index if not exists lead_interactions_gmail_message_unique
  on public.lead_interactions (lead_id, gmail_mailbox, gmail_message_id)
  where gmail_mailbox is not null and gmail_message_id is not null;

-- The RFC Message-ID is shared when an incoming message reaches several
-- synchronized mailboxes, preventing it from appearing twice for one lead.
create unique index if not exists lead_interactions_gmail_rfc_message_unique
  on public.lead_interactions (lead_id, gmail_rfc_message_id)
  where gmail_rfc_message_id is not null;