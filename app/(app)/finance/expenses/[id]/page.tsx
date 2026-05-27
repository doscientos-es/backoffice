import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCE_LABELS,
  type ExpenseCategory,
  type ExpenseRecurrence,
  type ExpenseStatus,
} from "@/lib/finance";
import { EXPENSE_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExpense } from "../actions";
import { ExpenseEditDialog } from "./expense-edit-dialog";

export const dynamic = "force-dynamic";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createServerClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("*, projects(id, name, clients(id, name))")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!expense) notFound();

  const project = (
    expense as unknown as {
      projects: { id: string; name: string; clients: { id: string; name: string } | null } | null;
    }
  ).projects;

  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("id, name, clients(name)")
    .is("deleted_at", null)
    .order("name");

  const projectOptions = ((projectsRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    clients: { name: string } | { name: string }[] | null;
  }>).map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] ?? null : p.clients;
    return { id: p.id, name: p.name, clientName: client?.name ?? null };
  });

  const canDelete = user.role === "owner" || user.role === "admin";
  const canEdit = user.role !== "viewer";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={expense.vendor as string}
        description={
          EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory] ??
          (expense.category as string)
        }
        back={<BackLink href="/finance/expenses" label="Volver a gastos" />}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge meta={EXPENSE_STATUS} value={expense.status as ExpenseStatus} />
            {canEdit ? (
              <ExpenseEditDialog
                expense={{
                  id: id,
                  vendor: expense.vendor as string,
                  description: (expense.description as string | null) ?? null,
                  category: expense.category as string,
                  status: expense.status as string,
                  recurrence: expense.recurrence as string,
                  expense_date: expense.expense_date as string,
                  due_date: (expense.due_date as string | null) ?? null,
                  paid_at: (expense.paid_at as string | null) ?? null,
                  currency: expense.currency as string,
                  subtotal: Number(expense.subtotal ?? 0),
                  tax_rate: Number(expense.tax_rate ?? 0),
                  vendor_nif: (expense.vendor_nif as string | null) ?? null,
                  invoice_reference: (expense.invoice_reference as string | null) ?? null,
                  project_id: (expense.project_id as string | null) ?? null,
                  notes: (expense.notes as string | null) ?? null,
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
              <DetailRow label="Proveedor">{expense.vendor as string}</DetailRow>
              <DetailRow label="Categoría">
                {EXPENSE_CATEGORY_LABELS[expense.category as ExpenseCategory] ??
                  (expense.category as string)}
              </DetailRow>
              <DetailRow label="Recurrencia">
                {EXPENSE_RECURRENCE_LABELS[expense.recurrence as ExpenseRecurrence] ??
                  (expense.recurrence as string)}
              </DetailRow>
              <DetailRow label="Fecha">{formatDate(expense.expense_date as string)}</DetailRow>
              <DetailRow label="Vencimiento">
                {formatDate(expense.due_date as string | null)}
              </DetailRow>
              <DetailRow label="Pagado">{formatDate(expense.paid_at as string | null)}</DetailRow>
              <DetailRow label="Subtotal">
                <span className="tabular-nums">{formatEUR(Number(expense.subtotal ?? 0))}</span>
              </DetailRow>
              <DetailRow label="IVA">
                <span className="tabular-nums">
                  {Number(expense.tax_rate ?? 0)}% · {formatEUR(Number(expense.tax_amount ?? 0))}
                </span>
              </DetailRow>
              <DetailRow label="Total">
                <span className="font-semibold tabular-nums">
                  {formatEUR(Number(expense.total ?? 0))}
                </span>
              </DetailRow>
              {project ? (
                <DetailRow label="Proyecto">
                  <Link href={`/projects/${project.id}`} className="hover:underline">
                    {project.name}
                  </Link>
                  {project.clients ? (
                    <span className="text-muted-foreground"> · {project.clients.name}</span>
                  ) : null}
                </DetailRow>
              ) : null}
              {(expense.invoice_reference as string | null) ? (
                <DetailRow label="Nº factura">{expense.invoice_reference as string}</DetailRow>
              ) : null}
              {(expense.vendor_nif as string | null) ? (
                <DetailRow label="NIF">{expense.vendor_nif as string}</DetailRow>
              ) : null}
            </DetailGrid>
            {(expense.notes as string | null) ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notas
                </p>
                <p className="whitespace-pre-wrap text-sm">{expense.notes as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {canDelete ? (
        <Card>
          <CardHeader>
            <CardTitle>Zona peligrosa</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={deleteExpense} className="flex items-center justify-between gap-3">
              <input type="hidden" name="id" value={id} />
              <p className="text-sm text-muted-foreground">
                El gasto se eliminará del listado y dejará de contar en finanzas.
              </p>
              <Button type="submit" variant="destructive" size="sm">
                Eliminar gasto
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
