-- ============================================================
-- Subscriptions · recurring billing (mantenimientos, hosting, retainers)
-- Models predictable MRR and feeds periodic invoice generation.
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type subscription_status as enum ('active','paused','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_billing_cycle as enum ('monthly','quarterly','yearly');
exception when duplicate_object then null; end $$;

-- ---------- SUBSCRIPTIONS ----------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  client_id uuid not null references public.clients(id) on delete restrict,
  project_id uuid references public.projects(id) on delete set null,

  name text not null,                                   -- "Mantenimiento web", "Hosting + soporte"
  description text,
  status subscription_status not null default 'active',
  billing_cycle subscription_billing_cycle not null default 'monthly',

  -- Importes (por periodo, sin IVA)
  currency text not null default 'EUR',
  amount numeric(12,2) not null default 0,              -- base imponible por periodo
  vat_rate numeric(5,2) not null default 21.00,

  -- Fechas del ciclo
  start_date date not null default current_date,
  next_invoice_date date not null default current_date, -- próxima fecha a facturar
  end_date date,                                        -- fin previsto (renovación / baja)
  last_invoiced_at date,                                -- última factura generada

  notes text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists subscriptions_client_idx
  on public.subscriptions(client_id) where deleted_at is null;
create index if not exists subscriptions_status_idx
  on public.subscriptions(status) where deleted_at is null;
create index if not exists subscriptions_next_invoice_idx
  on public.subscriptions(next_invoice_date) where deleted_at is null and status = 'active';
create index if not exists subscriptions_project_idx
  on public.subscriptions(project_id) where deleted_at is null and project_id is not null;

-- ---------- RLS ----------
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (public.is_team_member());

drop policy if exists subscriptions_insert on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists subscriptions_update on public.subscriptions;
create policy subscriptions_update on public.subscriptions
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists subscriptions_delete on public.subscriptions;
create policy subscriptions_delete on public.subscriptions
  for delete using (public.current_member_role() in ('owner','admin'));

-- ---------- updated_at trigger ----------
drop trigger if exists trg_touch_subscriptions on public.subscriptions;
create trigger trg_touch_subscriptions
  before update on public.subscriptions
  for each row execute function public.fn_touch_updated_at();
