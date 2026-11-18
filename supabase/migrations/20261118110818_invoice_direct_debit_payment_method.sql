alter table public.invoices
  drop constraint invoices_payment_method_check,
  add constraint invoices_payment_method_check
    check (payment_method is null or payment_method in ('transfer', 'card', 'bizum', 'cash', 'direct_debit', 'other'));

alter table public.invoice_payments
  drop constraint invoice_payments_payment_method_check,
  add constraint invoice_payments_payment_method_check
    check (payment_method is null or payment_method in ('transfer', 'card', 'bizum', 'cash', 'direct_debit', 'other'));
