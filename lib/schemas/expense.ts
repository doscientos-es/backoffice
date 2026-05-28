import { z } from "zod";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_RECURRENCES,
  EXPENSE_STATUSES,
} from "@/lib/finance";
import { emptyToUndef, uuidIdInput } from "./common";

/**
 * Zod schemas for the `expenses` domain.
 *
 * Re-exports the canonical enums from `lib/finance` so callers only need to
 * touch `lib/schemas/expense` for validation + type derivation.
 */

export { EXPENSE_CATEGORIES, EXPENSE_RECURRENCES, EXPENSE_STATUSES };

export const ExpenseCategory = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategoryType = z.infer<typeof ExpenseCategory>;

export const ExpenseStatus = z.enum(EXPENSE_STATUSES);
export type ExpenseStatusType = z.infer<typeof ExpenseStatus>;

export const ExpenseRecurrence = z.enum(EXPENSE_RECURRENCES);
export type ExpenseRecurrenceType = z.infer<typeof ExpenseRecurrence>;

/**
 * Shape produced by the new-expense / edit-expense forms. Strings come from
 * HTML inputs so we coerce + collapse empty strings to undefined wherever the
 * field is optional. The shape stays usable from both FormData (via
 * `formDataToObject`) and JSON callers.
 */
export const ExpenseInput = z.object({
  vendor: z.string().min(1, "El proveedor es obligatorio").max(160),
  description: z.string().max(400).optional().or(emptyToUndef),
  category: ExpenseCategory.default("other"),
  status: ExpenseStatus.default("paid"),
  recurrence: ExpenseRecurrence.default("none"),
  expense_date: z.string().min(1, "La fecha es obligatoria"),
  due_date: z.string().optional().or(emptyToUndef),
  paid_at: z.string().optional().or(emptyToUndef),
  currency: z.string().min(3).max(3).default("EUR"),
  subtotal: z.coerce.number().min(0, "El importe debe ser ≥ 0"),
  tax_rate: z.coerce.number().min(0).max(100).default(21),
  vendor_nif: z.string().max(20).optional().or(emptyToUndef),
  invoice_reference: z.string().max(80).optional().or(emptyToUndef),
  project_id: z.string().uuid().optional().or(emptyToUndef),
  notes: z.string().max(4000).optional().or(emptyToUndef),
});
export type ExpenseInputType = z.infer<typeof ExpenseInput>;

export const ExpenseIdInput = uuidIdInput;

/**
 * Wire shape used by `updateExpense`: all fields are submitted as strings
 * from the edit form and then validated by `ExpenseInput`. Kept as a
 * dedicated type so callers (form handlers) don't need to know about the
 * parsed/coerced shape.
 */
export type UpdateExpenseInput = {
  id: string;
  vendor: string;
  description: string;
  category: string;
  status: string;
  recurrence: string;
  expense_date: string;
  due_date: string;
  paid_at: string;
  currency: string;
  subtotal: string;
  tax_rate: string;
  vendor_nif: string;
  invoice_reference: string;
  project_id: string;
  notes: string;
};
