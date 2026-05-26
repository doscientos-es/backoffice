import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "@/lib/finance";
import { createServerClient } from "@/lib/supabase/server";
import { createExpense } from "../actions";

export const metadata = { title: "Nuevo gasto · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await requireUser();
  const supabase = await createServerClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, clients(name)")
    .is("deleted_at", null)
    .order("name");

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo gasto"
        description="Registra un gasto operativo (Vercel, Supabase, dominios, software…)."
        back={<BackLink href="/finance/expenses" label="Volver a gastos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createExpense} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormRow label="Proveedor" htmlFor="vendor" required>
                <Input
                  id="vendor"
                  name="vendor"
                  required
                  maxLength={160}
                  autoFocus
                  placeholder="Vercel, Supabase, OpenAI…"
                />
              </FormRow>
              <FormRow label="Categoría" htmlFor="category">
                <Select id="category" name="category" defaultValue="service">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Fecha del gasto" htmlFor="expense_date" required>
                <Input
                  id="expense_date"
                  name="expense_date"
                  type="date"
                  defaultValue={today}
                  required
                />
              </FormRow>
              <FormRow label="Vencimiento" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </FormRow>
              <FormRow label="Estado" htmlFor="status">
                <Select id="status" name="status" defaultValue="paid">
                  {EXPENSE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {EXPENSE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Recurrencia" htmlFor="recurrence">
                <Select id="recurrence" name="recurrence" defaultValue="none">
                  {EXPENSE_RECURRENCES.map((r) => (
                    <option key={r} value={r}>
                      {EXPENSE_RECURRENCE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </FormRow>
              <FormRow label="Subtotal (sin IVA)" htmlFor="subtotal" required>
                <Input
                  id="subtotal"
                  name="subtotal"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue="0"
                  inputMode="decimal"
                />
              </FormRow>
              <FormRow label="IVA %" htmlFor="tax_rate">
                <Input
                  id="tax_rate"
                  name="tax_rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue="21"
                  inputMode="decimal"
                />
              </FormRow>
              <FormRow label="Moneda" htmlFor="currency">
                <Input id="currency" name="currency" maxLength={3} defaultValue="EUR" />
              </FormRow>
              <FormRow label="Fecha de pago" htmlFor="paid_at">
                <Input id="paid_at" name="paid_at" type="date" />
              </FormRow>
              <FormRow label="NIF proveedor" htmlFor="vendor_nif">
                <Input id="vendor_nif" name="vendor_nif" maxLength={20} placeholder="ESBxxxxxxxx" />
              </FormRow>
              <FormRow label="Nº factura proveedor" htmlFor="invoice_reference">
                <Input id="invoice_reference" name="invoice_reference" maxLength={80} />
              </FormRow>
              <FormRow label="Proyecto (opcional)" htmlFor="project_id">
                <Select id="project_id" name="project_id" defaultValue="">
                  <option value="">— Ninguno —</option>
                  {projects?.map((p) => {
                    const client = (p as unknown as { clients: { name: string } | null }).clients;
                    return (
                      <option key={p.id as string} value={p.id as string}>
                        {p.name as string}
                        {client ? ` · ${client.name}` : ""}
                      </option>
                    );
                  })}
                </Select>
              </FormRow>
            </div>
            <FormRow label="Descripción" htmlFor="description">
              <Input
                id="description"
                name="description"
                maxLength={400}
                placeholder="Hosting mensual, dominio anual…"
              />
            </FormRow>
            <FormRow label="Notas" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
            </FormRow>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" size="sm">
                Crear gasto
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
