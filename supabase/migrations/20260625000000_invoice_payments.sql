-- Payment records for invoices.
-- Supports partial / multi-payment scenarios via Redsys (BBVA Paygold).
-- Each Redsys transaction maps 1-to-1 with a row here.

create table if not exists public.invoice_payments (
  id                    uuid          primary key default gen_random_uuid(),
  seq                   bigserial     not null unique,
  invoice_id            uuid          not null references public.invoices(id) on delete restrict,
  amount                numeric(12,2) not null,          -- EUR
  -- 12-char zero-padded seq used as Redsys Ds_Merchant_Order.
  -- First 4 chars are always numeric ('0000'…) which satisfies Redsys constraints.
  redsys_order          text generated always as (lpad(seq::text, 12, '0')) stored unique,
  status                text          not null default 'pending'
                                      check (status in ('pending', 'confirmed', 'failed')),
  ds_response           text,
  ds_authorisation_code text,
  created_at            timestamptz   not null default now(),
  confirmed_at          timestamptz
);

create index if not exists invoice_payments_invoice_idx on public.invoice_payments(invoice_id);
create index if not exists invoice_payments_order_idx   on public.invoice_payments(redsys_order);
create index if not exists invoice_payments_status_idx  on public.invoice_payments(status)
  where status = 'confirmed';
