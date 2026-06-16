-- Add paid_at timestamp to invoices.
-- Populated by updateInvoiceStatus when transitioning to 'paid',
-- cleared back to NULL when reverting to any other status.

alter table public.invoices
  add column if not exists paid_at timestamptz;
