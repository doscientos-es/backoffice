-- ============================================================
-- Add structured address columns back to public.settings.
-- The single freeform `company_address` column is kept intact
-- so the existing PDF query (company_address) keeps working
-- without changes; the action now writes both the split fields
-- AND recomputes company_address via formatAddress logic.
-- ============================================================

alter table public.settings
  add column if not exists company_address_street   text,
  add column if not exists company_address_zip      text,
  add column if not exists company_address_city     text,
  add column if not exists company_address_province text,
  add column if not exists company_address_country  text not null default 'ES';

-- Seed street from the existing freeform value (best-effort).
update public.settings
  set company_address_street = company_address
  where company_address is not null
    and company_address_street is null;
