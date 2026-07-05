-- ============================================================
-- Work logs — vínculo con facturas
-- ------------------------------------------------------------
-- Añade una FK opcional `invoice_id` a `work_logs` para registrar
-- qué logs han sido incluidos en una factura concreta. Permite:
--   · Evitar facturar el mismo log dos veces.
--   · Mostrar el desglose de actividad en el portal del cliente.
-- ============================================================

alter table public.work_logs
  add column if not exists invoice_id uuid references public.invoices(id) on delete set null;

create index if not exists work_logs_invoice_idx on public.work_logs(invoice_id)
  where invoice_id is not null;

comment on column public.work_logs.invoice_id is
  'Factura a la que se ha incluido este registro de horas. NULL = no facturado aún.';
