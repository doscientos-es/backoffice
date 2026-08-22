-- Passkeys are scoped by WebAuthn relying-party ID. Keep credentials from
-- localhost, production and demo separate even if a development setup points
-- at the same database. Existing rows remain nullable for production-only
-- backwards compatibility and are never modified by this migration.

alter table public.webauthn_credentials
  add column if not exists rp_id text;

alter table public.webauthn_credentials
  drop constraint if exists webauthn_credentials_rp_id_not_blank;

alter table public.webauthn_credentials
  add constraint webauthn_credentials_rp_id_not_blank
  check (rp_id is null or btrim(rp_id) <> '') not valid;

alter table public.webauthn_credentials
  validate constraint webauthn_credentials_rp_id_not_blank;

create index if not exists webauthn_credentials_user_rp_id_idx
  on public.webauthn_credentials(user_id, rp_id);