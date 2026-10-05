alter table public.invoice_payments
  add column if not exists proposal_payment_plan_item_id text;

create unique index if not exists invoice_payments_confirmed_plan_item_unique_idx
  on public.invoice_payments (proposal_id, proposal_payment_plan_item_id)
  where proposal_id is not null
    and proposal_payment_plan_item_id is not null
    and status = 'confirmed';

comment on column public.invoice_payments.proposal_payment_plan_item_id is
  'Payment-plan item covered by a payment recorded directly against a proposal.';
