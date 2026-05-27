import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_RECURRENCES,
  EXPENSE_RECURRENCE_LABELS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_LABELS,
} from "@/lib/finance";

export type ExpenseFormDefaults = {
  vendor?: string;
  description?: string | null;
  category?: string;
  status?: string;
  recurrence?: string;
  expense_date?: string;
  due_date?: string | null;
  paid_at?: string | null;
  currency?: string;
  subtotal?: number | string;
  tax_rate?: number | string;
  vendor_nif?: string | null;
  invoice_reference?: string | null;
  project_id?: string | null;
  notes?: string | null;
};

interface Props {
  defaults?: ExpenseFormDefaults;
  /** Avoids `id` collisions when create and edit forms coexist on the page. */
  idPrefix?: string;
  autoFocusVendor?: boolean;
  projects?: Array<{ id: string; name: string; clientName?: string | null }>;
}

/**
 * Shared field block for the expense create and edit forms. Server actions
 * own validation/computation (totals from subtotal + tax_rate).
 */
export function ExpenseFormFields({
  defaults,
  idPrefix = "expense",
  autoFocusVendor = false,
  projects = [],
}: Props) {
  const d = defaults ?? {};
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Proveedor" htmlFor={`${idPrefix}-vendor`} required>
          <Input
            id={`${idPrefix}-vendor`}
            name="vendor"
            required
            maxLength={160}
            autoFocus={autoFocusVendor}
            placeholder="Vercel, Supabase, OpenAI…"
            defaultValue={d.vendor ?? ""}
          />
        </FormRow>
        <FormRow label="Categoría" htmlFor={`${idPrefix}-category`}>
          <Select
            id={`${idPrefix}-category`}
            name="category"
            defaultValue={d.category ?? "service"}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Fecha del gasto" htmlFor={`${idPrefix}-expense_date`} required>
          <Input
            id={`${idPrefix}-expense_date`}
            name="expense_date"
            type="date"
            required
            defaultValue={d.expense_date ?? new Date().toISOString().slice(0, 10)}
          />
        </FormRow>
        <FormRow label="Vencimiento" htmlFor={`${idPrefix}-due_date`}>
          <Input
            id={`${idPrefix}-due_date`}
            name="due_date"
            type="date"
            defaultValue={d.due_date ?? ""}
          />
        </FormRow>
        <FormRow label="Estado" htmlFor={`${idPrefix}-status`}>
          <Select id={`${idPrefix}-status`} name="status" defaultValue={d.status ?? "paid"}>
            {EXPENSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EXPENSE_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Recurrencia" htmlFor={`${idPrefix}-recurrence`}>
          <Select
            id={`${idPrefix}-recurrence`}
            name="recurrence"
            defaultValue={d.recurrence ?? "none"}
          >
            {EXPENSE_RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {EXPENSE_RECURRENCE_LABELS[r]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Subtotal (sin IVA)" htmlFor={`${idPrefix}-subtotal`} required>
          <Input
            id={`${idPrefix}-subtotal`}
            name="subtotal"
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            defaultValue={(d.subtotal ?? 0).toString()}
          />
        </FormRow>
        <FormRow label="IVA %" htmlFor={`${idPrefix}-tax_rate`}>
          <Input
            id={`${idPrefix}-tax_rate`}
            name="tax_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            inputMode="decimal"
            defaultValue={(d.tax_rate ?? 21).toString()}
          />
        </FormRow>
        <FormRow label="Moneda" htmlFor={`${idPrefix}-currency`}>
          <Input
            id={`${idPrefix}-currency`}
            name="currency"
            maxLength={3}
            defaultValue={d.currency ?? "EUR"}
          />
        </FormRow>
        <FormRow label="Fecha de pago" htmlFor={`${idPrefix}-paid_at`}>
          <Input
            id={`${idPrefix}-paid_at`}
            name="paid_at"
            type="date"
            defaultValue={d.paid_at ?? ""}
          />
        </FormRow>
        <FormRow label="NIF proveedor" htmlFor={`${idPrefix}-vendor_nif`}>
          <Input
            id={`${idPrefix}-vendor_nif`}
            name="vendor_nif"
            maxLength={20}
            placeholder="ESBxxxxxxxx"
            defaultValue={d.vendor_nif ?? ""}
          />
        </FormRow>
        <FormRow label="Nº factura proveedor" htmlFor={`${idPrefix}-invoice_reference`}>
          <Input
            id={`${idPrefix}-invoice_reference`}
            name="invoice_reference"
            maxLength={80}
            defaultValue={d.invoice_reference ?? ""}
          />
        </FormRow>
        <FormRow label="Proyecto (opcional)" htmlFor={`${idPrefix}-project_id`}>
          <Select
            id={`${idPrefix}-project_id`}
            name="project_id"
            defaultValue={d.project_id ?? ""}
          >
            <option value="">— Ninguno —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.clientName ? ` · ${p.clientName}` : ""}
              </option>
            ))}
          </Select>
        </FormRow>
      </div>
      <FormRow label="Descripción" htmlFor={`${idPrefix}-description`}>
        <Input
          id={`${idPrefix}-description`}
          name="description"
          maxLength={400}
          placeholder="Hosting mensual, dominio anual…"
          defaultValue={d.description ?? ""}
        />
      </FormRow>
      <FormRow label="Notas" htmlFor={`${idPrefix}-notes`}>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={d.notes ?? ""}
        />
      </FormRow>
    </>
  );
}
