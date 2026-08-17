-- Add a reusable commercial template: every module is paid before its work starts.
-- The per-module amounts remain editorial terms; no automated single payment is created.

alter table public.proposals
  drop constraint if exists proposals_payment_schedule_check;

alter table public.proposals
  add constraint proposals_payment_schedule_check
  check (
    payment_schedule in (
      'upfront',
      'half_half',
      '30_40_30',
      'per_module_upfront',
      'custom'
    )
  );

comment on column public.proposals.payment_schedule is
  'Payment template selection: upfront, half_half, 30_40_30, per_module_upfront or custom.';