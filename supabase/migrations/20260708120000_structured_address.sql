-- ============================================================
-- Structured address fields
-- ============================================================
-- Replaces freeform text fields with per-part columns so every
-- address is always legally complete and consistently formatted.
--
-- Tables affected:
--   clients  : billing_address  → billing_address_{street,zip,city,province,country}
--   settings : company_address  → company_address_{street,zip,city,province,country}
--   invoices : client_address   → client_address_{street,zip,city,province,country}
--              + operation_date (Mejora B: fecha de devengo cuando difiere de emisión)
--
-- Mejora C: trigger that raises an exception when fiscal-snapshot
--   fields are modified on an already-issued/paid/cancelled invoice.
-- ============================================================

-- ── clients ──────────────────────────────────────────────────
alter table public.clients
  add column if not exists billing_address_street   text,
  add column if not exists billing_address_zip      text,
  add column if not exists billing_address_city     text,
  add column if not exists billing_address_province text,
  add column if not exists billing_address_country  text not null default 'ES';

-- Migrate existing freeform data into street (best-effort; admins can clean up).
update public.clients
  set billing_address_street = billing_address
  where billing_address is not null
    and billing_address_street is null;

alter table public.clients drop column if exists billing_address;

-- ── settings ─────────────────────────────────────────────────
alter table public.settings
  add column if not exists company_address_street   text,
  add column if not exists company_address_zip      text,
  add column if not exists company_address_city     text,
  add column if not exists company_address_province text,
  add column if not exists company_address_country  text not null default 'ES';

update public.settings
  set company_address_street = company_address
  where company_address is not null
    and company_address_street is null;

alter table public.settings drop column if exists company_address;

-- ── invoices ─────────────────────────────────────────────────
alter table public.invoices
  add column if not exists client_address_street   text,
  add column if not exists client_address_zip      text,
  add column if not exists client_address_city     text,
  add column if not exists client_address_province text,
  add column if not exists client_address_country  text,
  add column if not exists operation_date          date;

update public.invoices
  set client_address_street = client_address
  where client_address is not null
    and client_address_street is null;

alter table public.invoices drop column if exists client_address;

-- ── Mejora C: immutability trigger ───────────────────────────
-- Raises an exception if fiscal-snapshot fields are changed on a
-- non-draft invoice. Applied at the DB level so it holds even when
-- called with the service-role key (which bypasses RLS).
create or replace function public.fn_check_invoice_immutable()
returns trigger
language plpgsql
as $$
begin
  if OLD.status <> 'draft' then
    if (
      NEW.client_nif              is distinct from OLD.client_nif              or
      NEW.client_name             is distinct from OLD.client_name             or
      NEW.client_address_street   is distinct from OLD.client_address_street   or
      NEW.client_address_zip      is distinct from OLD.client_address_zip      or
      NEW.client_address_city     is distinct from OLD.client_address_city     or
      NEW.client_address_province is distinct from OLD.client_address_province or
      NEW.client_address_country  is distinct from OLD.client_address_country  or
      NEW.subtotal                is distinct from OLD.subtotal                 or
      NEW.tax_amount              is distinct from OLD.tax_amount               or
      NEW.total                   is distinct from OLD.total                    or
      NEW.issue_date              is distinct from OLD.issue_date               or
      NEW.series                  is distinct from OLD.series                   or
      NEW.number                  is distinct from OLD.number
    ) then
      raise exception
        'Factura % está en estado "%" y sus datos fiscales son inmutables.',
        OLD.full_number, OLD.status;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_invoice_immutable on public.invoices;
create trigger trg_invoice_immutable
  before update on public.invoices
  for each row execute function public.fn_check_invoice_immutable();
