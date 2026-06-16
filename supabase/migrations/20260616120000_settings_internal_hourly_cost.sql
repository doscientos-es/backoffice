-- ============================================================
-- settings.internal_hourly_cost — coste interno por hora (€/h).
-- ------------------------------------------------------------
-- Valor único de empresa usado para "valorar" las horas
-- registradas en work_logs al calcular la rentabilidad de un
-- proyecto: margen = ingresos − (Σ horas × coste_hora + gastos).
-- Por defecto 0 → las horas no penalizan el margen hasta que se
-- configure en Ajustes › Empresa. No afecta a facturas/propuestas.
-- ============================================================

alter table public.settings
  add column if not exists internal_hourly_cost numeric(10,2) not null default 0;
