-- Trace automatic proposal acceptance and project portal invitation emails.
-- Timestamps also act as idempotency claims so retries cannot send duplicates.

alter table public.proposals
  add column if not exists acceptance_email_sent_at timestamptz,
  add column if not exists acceptance_email_recipient text,
  add column if not exists acceptance_email_resend_id text;

alter table public.projects
  add column if not exists portal_invite_sent_at timestamptz,
  add column if not exists portal_invite_recipient text,
  add column if not exists portal_invite_resend_id text;

comment on column public.proposals.acceptance_email_sent_at is
  'Claim and send time for the automatic proposal acceptance acknowledgement.';
comment on column public.projects.portal_invite_sent_at is
  'Last time the client was emailed a link to the published project portal.';