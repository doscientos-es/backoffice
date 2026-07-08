-- =============================================================================
-- Medio de cobro + créditos incobrables (art. 80.Tres/Cuatro LIVA)
--
-- payment_method: cómo se cobró la factura (transferencia, tarjeta, bizum…)
--   Poblado por:
--     · updateInvoiceStatus (cobro manual: transfer/bizum/cash/other)
--     · Webhook Redsys (payment_method = 'card' automáticamente)
--   Útil para el Libro Registro, el modelo 347 y criterio de caja.
--
-- is_uncollectible / uncollectible_at: crédito incobrable según art. 80.Tres
--   LIVA. Permite recuperar el IVA emitido de facturas no cobradas tras 6/12
--   meses del vencimiento emitiendo una factura rectificativa R4.
-- =============================================================================

alter table public.invoices
  add column if not exists payment_method   text
    check (
      payment_method is null or
      payment_method in ('transfer', 'card', 'bizum', 'cash', 'other')
    ),
  add column if not exists is_uncollectible boolean      not null default false,
  add column if not exists uncollectible_at timestamptz;

-- Índice para consultas de incobrables pendientes de rectificativa
create index if not exists invoices_uncollectible_idx
  on public.invoices(uncollectible_at)
  where is_uncollectible = true and deleted_at is null;
