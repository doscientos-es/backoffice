-- Store the payment method on each collection so manual transfers and
-- instalments remain distinguishable from Redsys payments.
alter table public.invoice_payments
  add column if not exists payment_method text
  check (payment_method is null or payment_method in ('transfer', 'card', 'bizum', 'cash', 'other'));
