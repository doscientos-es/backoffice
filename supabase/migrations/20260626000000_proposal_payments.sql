-- Add proposal_id to invoice_payments to support deposits/payments directly from proposals.
alter table public.invoice_payments 
  add column if not exists proposal_id uuid references public.proposals(id) on delete set null;

-- Make invoice_id optional if proposal_id is present (or keep it as is if we always link to a draft invoice).
-- For now, let's allow either to be present.
alter table public.invoice_payments alter column invoice_id drop not null;

-- Ensure at least one link is present.
alter table public.invoice_payments add constraint invoice_payments_target_check
  check (invoice_id is not null or proposal_id is not null);

create index if not exists invoice_payments_proposal_idx on public.invoice_payments(proposal_id);
