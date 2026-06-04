-- ============================================================
-- Portal access controls for proposals and invoices.
--
-- Adds two optional gates to the public /p links:
--   * is_client_visible    — admin toggle to hide a resource from the
--                            client without deleting it. Defaults to true
--                            so every existing link keeps working as before.
--   * portal_password_hash — optional scrypt hash. When present, the public
--                            page asks the visitor for the password before
--                            revealing the document. NULL = no password.
-- ============================================================

alter table public.proposals
  add column if not exists is_client_visible boolean not null default true,
  add column if not exists portal_password_hash text;

alter table public.invoices
  add column if not exists is_client_visible boolean not null default true,
  add column if not exists portal_password_hash text;

comment on column public.proposals.is_client_visible is
  'When false the public /p/proposal link returns 404 for clients (team previews still work).';
comment on column public.proposals.portal_password_hash is
  'Optional scrypt hash gating the public link. NULL = open access.';
comment on column public.invoices.is_client_visible is
  'When false the public /p/invoice link returns 404 for clients (team previews still work).';
comment on column public.invoices.portal_password_hash is
  'Optional scrypt hash gating the public link. NULL = open access.';
