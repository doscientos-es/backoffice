-- Corrective follow-up: the table was created after the broad grant hardening
-- and inherited non-CRUD privileges. Authenticated users may only read their
-- own credentials through the remaining SELECT RLS policy.
revoke all privileges on table public.webauthn_credentials from anon, authenticated;
grant select on table public.webauthn_credentials to authenticated;