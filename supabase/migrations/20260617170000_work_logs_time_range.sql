-- ============================================================
-- Work logs — rango horario opcional (inicio → fin)
-- ------------------------------------------------------------
-- Permite registrar una entrada por rango (p. ej. 09:00–13:20) y
-- que la duración se calcule en `hours`. Las columnas son nullable
-- para no romper las entradas existentes (que solo tienen `hours`).
-- `hours` sigue siendo la fuente de verdad para sumas y facturación.
-- ============================================================

alter table public.work_logs
  add column if not exists start_time time,
  add column if not exists end_time   time;

comment on column public.work_logs.start_time is
  'Hora de inicio (opcional). Si hay start_time y end_time, hours se deriva del rango.';
comment on column public.work_logs.end_time is
  'Hora de fin (opcional). Debe ser posterior a start_time.';
