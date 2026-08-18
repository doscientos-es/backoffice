-- WebAuthn credentials are security factors, not user-editable profile data.
-- All writes now run through verified server-side ceremonies with service_role.
drop policy if exists webauthn_credentials_insert_own on public.webauthn_credentials;
drop policy if exists webauthn_credentials_update_own on public.webauthn_credentials;
drop policy if exists webauthn_credentials_delete_own on public.webauthn_credentials;

revoke insert, update, delete on public.webauthn_credentials from authenticated;