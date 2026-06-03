-- Track whether an expense was paid by the company account or a team member personally.
-- Useful while the company account isn't set up yet and partners front costs directly.

create type expense_payment_source as enum ('company', 'member');

alter table expenses
  add column payment_source expense_payment_source not null default 'company',
  add column paid_by_member_id uuid references team_members(id) on delete set null;

-- Enforce: when source is 'member', the member must be identified.
alter table expenses
  add constraint expenses_member_required
  check (payment_source = 'company' or paid_by_member_id is not null);

-- Allow members to register their personal IBAN for contribution tracking.
alter table team_members
  add column iban text;
