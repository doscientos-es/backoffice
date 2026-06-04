-- Drop personal IBAN on team_members.
-- We're not tracking partner reimbursements at this stage; for the company-side
-- IBAN (used on invoices) keep `public.settings.iban` untouched.

alter table public.team_members
  drop column if exists iban;
