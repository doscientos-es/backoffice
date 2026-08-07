-- WebAuthn credentials are public-key authenticators bound to one auth user.
-- No biometric template or private key ever reaches this database.

create table if not exists public.webauthn_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0 check (counter >= 0),
  transports text[] not null default '{}',
  device_type text not null check (device_type in ('singleDevice', 'multiDevice')),
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists webauthn_credentials_user_id_idx
  on public.webauthn_credentials(user_id);

alter table public.webauthn_credentials enable row level security;

drop policy if exists webauthn_credentials_select_own on public.webauthn_credentials;
create policy webauthn_credentials_select_own on public.webauthn_credentials
  for select using (user_id = (select auth.uid()));

drop policy if exists webauthn_credentials_insert_own on public.webauthn_credentials;
create policy webauthn_credentials_insert_own on public.webauthn_credentials
  for insert with check (user_id = (select auth.uid()));

drop policy if exists webauthn_credentials_update_own on public.webauthn_credentials;
create policy webauthn_credentials_update_own on public.webauthn_credentials
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists webauthn_credentials_delete_own on public.webauthn_credentials;
create policy webauthn_credentials_delete_own on public.webauthn_credentials
  for delete using (user_id = (select auth.uid()));
