-- ============================================================
-- Per-project hourly billing (optional)
-- ============================================================
--
-- Most projects are billed at a fixed price and keep `billing_type = 'fixed'`.
-- Hourly engagements (e.g. Palumba: 40 €/h, sin impuestos) set
-- `billing_type = 'hourly'` and an `hourly_rate`. Their monthly invoice is
-- generated from the hours logged in `public.work_logs` for the period.
--
-- `hourly_vat_rate` lets each hourly project carry its own VAT (Palumba = 0).

alter table public.projects
  add column if not exists billing_type text not null default 'fixed'
    check (billing_type in ('fixed', 'hourly')),
  add column if not exists hourly_rate numeric(10, 2)
    check (hourly_rate is null or hourly_rate >= 0),
  add column if not exists hourly_vat_rate numeric(5, 2) not null default 21.00
    check (hourly_vat_rate >= 0 and hourly_vat_rate <= 100);

comment on column public.projects.billing_type is
  'Modelo de facturación: ''fixed'' (precio cerrado) u ''hourly'' (por horas registradas).';
comment on column public.projects.hourly_rate is
  'Tarifa por hora (€) aplicada al generar la factura mensual de un proyecto hourly.';
comment on column public.projects.hourly_vat_rate is
  'IVA (%) aplicado a la factura por horas. 0 para proyectos sin impuestos.';
