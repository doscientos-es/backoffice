import { BackLink } from "@/components/layout/back-link";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCES,
  EXPENSE_RECURRENCE_LABELS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
  type ExpenseCategory,
  type ExpenseRecurrence,
  type ExpenseStatus,
} from "@/lib/finance";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteExpense, updateExpense } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<ExpenseStatus, "info" | "success" | "neutral"> = {
  pending: "info",
  paid: "success",
  cancelled: "neutral",
};

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

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  const canDelete = user.role === "owner" || user.role === "admin";

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
          <Badge variant={STATUS_VARIANT[expense.status as ExpenseStatus] ?? "neutral"}>
            {EXPENSE_STATUS_LABELS[expense.status as ExpenseStatus] ?? (expense.status as string)}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
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

        <Card>
          <CardHeader>
            <CardTitle>Editar</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateExpense} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="Proveedor" htmlFor="e_vendor">
                  <Input
                    id="e_vendor"
                    name="vendor"
                    required
                    maxLength={160}
                    defaultValue={expense.vendor as string}
                  />
                </FormRow>
                <FormRow label="Categoría" htmlFor="e_category">
                  <Select id="e_category" name="category" defaultValue={expense.category as string}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {EXPENSE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Fecha" htmlFor="e_date">
                  <Input
                    id="e_date"
                    name="expense_date"
                    type="date"
                    required
                    defaultValue={(expense.expense_date as string).slice(0, 10)}
                  />
                </FormRow>
                <FormRow label="Vencimiento" htmlFor="e_due">
                  <Input
                    id="e_due"
                    name="due_date"
                    type="date"
                    defaultValue={(expense.due_date as string | null)?.slice(0, 10) ?? ""}
                  />
                </FormRow>
                <FormRow label="Estado" htmlFor="e_status">
                  <Select id="e_status" name="status" defaultValue={expense.status as string}>
                    {EXPENSE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {EXPENSE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Recurrencia" htmlFor="e_recurrence">
                  <Select
                    id="e_recurrence"
                    name="recurrence"
                    defaultValue={expense.recurrence as string}
                  >
                    {EXPENSE_RECURRENCES.map((r) => (
                      <option key={r} value={r}>
                        {EXPENSE_RECURRENCE_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </FormRow>
                <FormRow label="Subtotal" htmlFor="e_subtotal">
                  <Input
                    id="e_subtotal"
                    name="subtotal"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={Number(expense.subtotal ?? 0).toString()}
                  />
                </FormRow>
                <FormRow label="IVA %" htmlFor="e_tax">
                  <Input
                    id="e_tax"
                    name="tax_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={Number(expense.tax_rate ?? 0).toString()}
                  />
                </FormRow>
                <FormRow label="Moneda" htmlFor="e_currency">
                  <Input
                    id="e_currency"
                    name="currency"
                    maxLength={3}
                    defaultValue={expense.currency as string}
                  />
                </FormRow>
                <FormRow label="Pagado" htmlFor="e_paid">
                  <Input
                    id="e_paid"
                    name="paid_at"
                    type="date"
                    defaultValue={(expense.paid_at as string | null)?.slice(0, 10) ?? ""}
                  />
                </FormRow>
                <FormRow label="NIF proveedor" htmlFor="e_nif">
                  <Input
                    id="e_nif"
                    name="vendor_nif"
                    maxLength={20}
                    defaultValue={(expense.vendor_nif as string | null) ?? ""}
                  />
                </FormRow>
                <FormRow label="Nº factura" htmlFor="e_ref">
                  <Input
                    id="e_ref"
                    name="invoice_reference"
                    maxLength={80}
                    defaultValue={(expense.invoice_reference as string | null) ?? ""}
                  />
                </FormRow>
                <FormRow label="Proyecto" htmlFor="e_project">
                  <Select id="e_project" name="project_id" defaultValue={project?.id ?? ""}>
                    <option value="">— Ninguno —</option>
                    {projects?.map((p) => (
                      <option key={p.id as string} value={p.id as string}>
                        {p.name as string}
                      </option>
                    ))}
                  </Select>
                </FormRow>
              </div>
              <FormRow label="Descripción" htmlFor="e_description">
                <Input
                  id="e_description"
                  name="description"
                  maxLength={400}
                  defaultValue={(expense.description as string | null) ?? ""}
                />
              </FormRow>
              <FormRow label="Notas" htmlFor="e_notes">
                <Textarea
                  id="e_notes"
                  name="notes"
                  rows={3}
                  maxLength={4000}
                  defaultValue={(expense.notes as string | null) ?? ""}
                />
              </FormRow>
              <div className="flex justify-end border-t border-border pt-3">
                <Button type="submit" size="sm">
                  Guardar
                </Button>
              </div>
            </form>
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
