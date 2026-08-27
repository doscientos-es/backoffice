-- ============================================================
-- Facturas recibidas: permitir adjuntar documentos a un gasto.
-- ============================================================

alter table public.attachments
  add column if not exists expense_id uuid references public.expenses(id) on delete set null;

create index if not exists attachments_expense_idx
  on public.attachments(expense_id)
  where deleted_at is null and expense_id is not null;

notify pgrst, 'reload schema';