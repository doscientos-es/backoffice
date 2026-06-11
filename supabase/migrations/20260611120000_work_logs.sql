-- ============================================================
-- Work logs — registro manual de horas diarias por proyecto.
-- ------------------------------------------------------------
-- NO es una vuelta al modelo de timers eliminado (time_entries).
-- Las entradas son manuales (fecha + horas + nota), están
-- disponibles en cualquier proyecto y sirven internamente para
-- derivar el €/h efectivo (total facturado ÷ Σ horas). Nunca se
-- muestran en el portal del cliente.
-- ============================================================

create table if not exists public.work_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  project_id  uuid not null references public.projects(id)      on delete cascade,
  member_id   uuid not null references public.team_members(id)  on delete restrict,
  work_date   date not null default current_date,
  hours       numeric(5,2) not null check (hours > 0 and hours <= 24),
  note        text,
  deleted_at  timestamptz
);

create index if not exists work_logs_project_idx on public.work_logs(project_id) where deleted_at is null;
create index if not exists work_logs_member_idx  on public.work_logs(member_id)  where deleted_at is null;

-- updated_at autotouch (reutiliza el trigger compartido)
drop trigger if exists trg_touch_work_logs on public.work_logs;
create trigger trg_touch_work_logs before update on public.work_logs
  for each row execute function public.fn_touch_updated_at();

-- ---------- RLS ----------
-- Lectura para cualquier team_member; alta/baja (soft-delete vía
-- update) requieren rol >= member. Consistente con el resto de
-- tablas de negocio (ver 20260525120300_rls.sql).
alter table public.work_logs enable row level security;

drop policy if exists "work_logs_select" on public.work_logs;
create policy "work_logs_select" on public.work_logs
  for select using (public.is_team_member() and deleted_at is null);

drop policy if exists "work_logs_insert" on public.work_logs;
create policy "work_logs_insert" on public.work_logs
  for insert with check (public.current_member_role() in ('owner','admin','member'));

drop policy if exists "work_logs_update" on public.work_logs;
create policy "work_logs_update" on public.work_logs
  for update using (public.current_member_role() in ('owner','admin','member'));
