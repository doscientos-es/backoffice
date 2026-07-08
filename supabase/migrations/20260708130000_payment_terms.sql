-- ============================================================
-- Payment terms + default due date
-- ============================================================
-- Adds an editable "payment terms" text used on invoices:
--   settings.payment_terms  : company-wide default (edited in Ajustes)
--   invoices.payment_terms  : optional per-invoice override
--
-- Also sets a sensible default for the invoice due date: 30 days
-- from the issue date (Ley 3/2004 default term between businesses).
-- Neither column is a fiscal-snapshot field, so both remain editable
-- while the invoice is a draft without touching the immutability
-- triggers.
-- ============================================================

-- ── settings: company-wide default terms ─────────────────────
alter table public.settings
  add column if not exists payment_terms text;

update public.settings
  set payment_terms = 'Pago mediante transferencia bancaria o pago online (tarjeta/Bizum). Vencimiento a 30 días desde la fecha de emisión.'
  where id = 1 and payment_terms is null;

-- ── invoices: per-invoice override + 30-day due date default ─
alter table public.invoices
  add column if not exists payment_terms text;

alter table public.invoices
  alter column due_date set default (current_date + 30);
