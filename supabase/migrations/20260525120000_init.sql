-- ============================================================
-- doscientos backoffice CRM — initial schema
-- Aligned with docs/description.md §6 (data model) and §7 (Verifactu)
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- ENUMS ----------
do $$ begin
  create type member_role as enum ('owner','admin','member','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new','qualifying','quoted','won','lost','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_temperature as enum ('hot','warm','cold');
exception when duplicate_object then null; end $$;

do $$ begin
  create type proposal_status as enum ('draft','sent','viewed','accepted','rejected','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum ('draft','issued','paid','overdue','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_type as enum ('F1','F2','F3','R1','R2','R3','R4','R5');
exception when duplicate_object then null; end $$;

do $$ begin
  create type verifactu_status as enum ('pending','submitted','accepted','rejected','excluded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type project_status as enum ('planning','active','on_hold','done','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo','doing','review','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interaction_type as enum (
    'email_sent','email_delivered','email_opened','email_clicked','email_bounced','email_complained',
    'call','meeting','note','portal_view','portal_accept','portal_reject'
  );
exception when duplicate_object then null; end $$;

-- ---------- TEAM MEMBERS ----------
create table if not exists public.team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  name text not null,
  role member_role not null default 'member',
  avatar_url text,
  email_alias text,
  signature_html text,
  email_send_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists team_members_role_idx on public.team_members(role) where deleted_at is null;

-- ---------- SETTINGS (singleton) ----------
create table if not exists public.settings (
  id smallint primary key default 1 check (id = 1),
  company_name text not null default 'doscientos',
  company_nif text,
  company_address text,
  iban text,
  default_vat_rate numeric(5,2) not null default 21.00,
  invoice_series text not null default 'A',
  invoice_next_number int not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ---------- LEADS ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext,
  phone text,
  company text,
  source text,
  status lead_status not null default 'new',
  temperature lead_temperature,
  score int,
  ai_summary text,
  assigned_to uuid references public.team_members(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists leads_status_idx on public.leads(status) where deleted_at is null;
create index if not exists leads_assigned_idx on public.leads(assigned_to) where deleted_at is null;
create index if not exists leads_created_idx on public.leads(created_at desc) where deleted_at is null;

-- ---------- CLIENTS ----------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  name text not null,
  nif text,
  email citext,
  phone text,
  billing_address text,
  contact_person text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists clients_nif_idx on public.clients(nif) where deleted_at is null;

-- ---------- PROJECTS ----------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  name text not null,
  description text,
  status project_status not null default 'planning',
  github_repo text,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists projects_client_idx on public.projects(client_id) where deleted_at is null;
create index if not exists projects_status_idx on public.projects(status) where deleted_at is null;
