-- =============================================================================
-- Facturas rectificativas (RD 1619/2012 art.15 + Verifactu RD 1007/2023)
--
-- Añade los campos de trazabilidad a la tabla invoices y el valor 'rectified'
-- al enum invoice_status para marcar la factura original una vez corregida.
-- La serie rectificativa usa 'R'; el número lo gestiona next_invoice_number(R).
-- =============================================================================

-- 1. Columnas en invoices
alter table public.invoices
  add column if not exists is_rectification    boolean not null default false,
  add column if not exists rectified_invoice_id uuid
    references public.invoices(id) on delete restrict,
  add column if not exists rectification_reason text,
  add column if not exists rectification_type   text
    check (
      rectification_type is null or
      rectification_type in ('R1','R2','R3','R4','R5')
    );

-- 2. Nuevo valor en el enum: factura original una vez que se ha emitido rectificativa
do $$ begin
  alter type invoice_status add value if not exists 'rectified';
exception when others then null; end $$;

-- 3. Índice para consultar rectificativas de una factura dada
create index if not exists invoices_rectified_idx
  on public.invoices(rectified_invoice_id)
  where rectified_invoice_id is not null;
