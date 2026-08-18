-- Apply only after the application version that writes through createAdminClient
-- is deployed. This restores the intended server-only mutation boundary after
-- the compatibility rollback for the previously deployed application.
revoke all privileges on table public.webauthn_credentials from anon, authenticated;
grant select on table public.webauthn_credentials to authenticated;

drop policy if exists webauthn_credentials_insert_own on public.webauthn_credentials;
drop policy if exists webauthn_credentials_update_own on public.webauthn_credentials;
drop policy if exists webauthn_credentials_delete_own on public.webauthn_credentials;