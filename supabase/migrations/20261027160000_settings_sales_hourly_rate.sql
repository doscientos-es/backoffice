-- ============================================================
-- settings.sales_hourly_rate — tarifa de venta por hora (€/h).
-- ------------------------------------------------------------
-- Valor único de empresa usado por la sugerencia de precio con IA
-- para convertir las horas estimadas en euros. Distinto de
-- internal_hourly_cost (coste interno). NULL = sin configurar:
-- la sugerencia pide configurarla en Ajustes › Empresa.
-- ============================================================

alter table public.settings
  add column if not exists sales_hourly_rate numeric(10,2)
    check (sales_hourly_rate is null or (sales_hourly_rate > 0 and sales_hourly_rate <= 1000));

comment on column public.settings.sales_hourly_rate is
  'Tarifa de venta por hora (€/h) para estimar precios de propuestas con IA.';
