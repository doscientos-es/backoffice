-- Feature: Vault of credentials
-- Adds an encrypted credential store (vault_items) and a master-password hash
-- column on the singleton settings row. The actual secret values are stored
-- AES-256-GCM encrypted at the application layer; this migration only sets up
-- the schema and RLS.

-- ─── settings: master password hash ──────────────────────────────────────────
alter table public.settings
  add column if not exists vault_password_hash text;

-- ─── service enum ─────────────────────────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'vault_service') then
    create type public.vault_service as enum (
      'hosting', 'domain', 'token', 'cms', 'database', 'api',
      'email', 'ssh', 'vpn', 'other'
    );
  end if;
end $$;

-- ─── vault_items ──────────────────────────────────────────────────────────────
create table if not exists public.vault_items (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  service          public.vault_service not null default 'other',
  username         text,
  secret_encrypted text        not null,   -- AES-256-GCM; format: iv:authTag:ciphertext (all hex)
  notes            text,
  is_sensitive     boolean     not null default true,
  expires_at       date,
  client_id        uuid        references public.clients(id) on delete set null,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists vault_items_client_idx  on public.vault_items(client_id) where deleted_at is null;
create index if not exists vault_items_expires_idx on public.vault_items(expires_at) where deleted_at is null and expires_at is not null;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.vault_items enable row level security;

drop policy if exists vault_items_select on public.vault_items;
create policy vault_items_select on public.vault_items
  for select using (public.is_team_member());

drop policy if exists vault_items_insert on public.vault_items;
create policy vault_items_insert on public.vault_items
  for insert with check (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists vault_items_update on public.vault_items;
create policy vault_items_update on public.vault_items
  for update using (public.current_member_role() in ('owner', 'admin', 'member'));

drop policy if exists vault_items_delete on public.vault_items;
create policy vault_items_delete on public.vault_items
  for delete using (public.current_member_role() in ('owner', 'admin'));
