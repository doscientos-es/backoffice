-- ============================================================
-- Finance · Expenses (gastos operativos: Vercel, Supabase, dominios, ...)
-- Complementa a public.invoices (ingresos) para tener cuentas centralizadas.
-- ============================================================

-- ---------- ENUMS ----------
do $$ begin
  create type expense_category as enum (
    'hosting',       -- Vercel, AWS, Railway
    'domain',        -- registro de dominios
    'service',       -- Supabase, Resend, OpenAI, APIs
    'software',      -- suscripciones SaaS (Figma, Notion, ...)
    'hardware',      -- equipo, dispositivos
    'office',        -- material de oficina, coworking
    'marketing',     -- ads, sponsorships
    'professional',  -- gestoría, abogados
    'travel',        -- desplazamientos, dietas
    'taxes',         -- IVA, IS, IRPF
    'salary',        -- nóminas, freelancers
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_status as enum ('pending','paid','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type expense_recurrence as enum ('none','monthly','quarterly','yearly');
exception when duplicate_object then null; end $$;

-- ---------- EXPENSES ----------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),

  vendor text not null,                                 -- "Vercel", "Supabase", "OpenAI"
  description text,
  category expense_category not null default 'other',
  status expense_status not null default 'paid',
  recurrence expense_recurrence not null default 'none',

  -- Fechas
  expense_date date not null default current_date,      -- fecha del gasto (factura del proveedor)
  due_date date,                                        -- vencimiento previsto
  paid_at date,                                         -- cuándo se pagó

  -- Importes
  currency text not null default 'EUR',
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 21.00,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,

  -- Datos del proveedor (snapshot)
  vendor_nif text,
  invoice_reference text,                               -- nº de factura del proveedor

  -- Atribución opcional
  project_id uuid references public.projects(id) on delete set null,

  notes text,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists expenses_date_idx     on public.expenses(expense_date desc) where deleted_at is null;
create index if not exists expenses_category_idx on public.expenses(category)          where deleted_at is null;
create index if not exists expenses_status_idx   on public.expenses(status)            where deleted_at is null;
create index if not exists expenses_vendor_idx   on public.expenses(vendor)            where deleted_at is null;
create index if not exists expenses_project_idx  on public.expenses(project_id)        where deleted_at is null and project_id is not null;

-- ---------- RLS ----------
alter table public.expenses enable row level security;

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select using (public.is_team_member());

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update using (public.current_member_role() in ('owner','admin','member'));

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete using (public.current_member_role() in ('owner','admin'));

-- ---------- updated_at trigger ----------
drop trigger if exists trg_touch_expenses on public.expenses;
create trigger trg_touch_expenses
  before update on public.expenses
  for each row execute function public.fn_touch_updated_at();
