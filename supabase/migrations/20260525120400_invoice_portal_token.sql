-- ============================================================
-- Public portal token for invoices (matches proposals.portal_token).
-- Enables read-only access to /p/invoice/[token] without auth.
-- ============================================================

alter table public.invoices
  add column if not exists portal_token text unique default encode(gen_random_bytes(24), 'hex');

create index if not exists invoices_portal_token_idx on public.invoices(portal_token)
  where deleted_at is null;
