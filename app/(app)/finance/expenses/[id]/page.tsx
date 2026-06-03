import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DangerZone } from "@/components/ui/danger-zone";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORY_LABELS, EXPENSE_RECURRENCE_LABELS } from "@/lib/finance";
import { getExpenseDetail } from "@/lib/finance/queries";
import { EXPENSE_STATUS } from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExpense } from "../actions";
import { ExpenseEditDialog } from "./expense-edit-dialog";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const result = await getExpenseDetail(id);
  if (!result) notFound();
  const { expense, projectOptions } = result;
  const project = expense.project;

  const canDelete = user.role === "owner" || user.role === "admin";
  const canEdit = user.role !== "viewer";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={expense.vendor}
        description={EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
        back={<BackLink href="/finance/expenses" label="Volver a gastos" />}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge meta={EXPENSE_STATUS} value={expense.status} />
            {canEdit ? (
              <ExpenseEditDialog
                expense={{
                  id: expense.id,
                  vendor: expense.vendor,
                  description: expense.description,
                  category: expense.category,
                  status: expense.status,
                  recurrence: expense.recurrence,
                  expense_date: expense.expense_date,
                  due_date: expense.due_date,
                  paid_at: expense.paid_at,
                  currency: expense.currency,
                  subtotal: expense.subtotal,
                  tax_rate: expense.tax_rate,
                  vendor_nif: expense.vendor_nif,
                  invoice_reference: expense.invoice_reference,
                  project_id: expense.project_id,
                  notes: expense.notes,
                }}
                projects={projectOptions}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Proveedor">{expense.vendor}</DetailRow>
              <DetailRow label="Categoría">
                {EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}
              </DetailRow>
              <DetailRow label="Recurrencia">
                {EXPENSE_RECURRENCE_LABELS[expense.recurrence] ?? expense.recurrence}
              </DetailRow>
              <DetailRow label="Fecha">{formatDate(expense.expense_date)}</DetailRow>
              <DetailRow label="Vencimiento">{formatDate(expense.due_date)}</DetailRow>
              <DetailRow label="Pagado">{formatDate(expense.paid_at)}</DetailRow>
              <DetailRow label="Subtotal">
                <span className="tabular-nums">{formatEUR(expense.subtotal)}</span>
              </DetailRow>
              <DetailRow label="IVA">
                <span className="tabular-nums">
                  {expense.tax_rate}% · {formatEUR(expense.tax_amount)}
                </span>
              </DetailRow>
              <DetailRow label="Total">
                <span className="font-semibold tabular-nums">{formatEUR(expense.total)}</span>
              </DetailRow>
              {project ? (
                <DetailRow label="Proyecto">
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                  {project.clientName ? (
                    <span className="text-muted-foreground"> · {project.clientName}</span>
                  ) : null}
                </DetailRow>
              ) : null}
              {expense.invoice_reference ? (
                <DetailRow label="Nº factura">{expense.invoice_reference}</DetailRow>
              ) : null}
              {expense.vendor_nif ? <DetailRow label="NIF">{expense.vendor_nif}</DetailRow> : null}
            </DetailGrid>
            {expense.notes ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <p className="whitespace-pre-wrap text-sm">{expense.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canDelete ? (
        <DangerZone>
          <form action={deleteExpense} className="flex items-center justify-between gap-3">
            <input type="hidden" name="id" value={id} />
            <p className="text-sm text-muted-foreground">
              El gasto se eliminará del listado y dejará de contar en finanzas.
            </p>
            <Button type="submit" variant="destructive" size="sm">
              Eliminar gasto
            </Button>
          </form>
        </DangerZone>
      ) : null}
    </div>
  );
}
