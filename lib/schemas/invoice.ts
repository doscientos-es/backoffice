import { z } from "zod";
import { lineItemInput, uuidIdInput } from "./common";

/**
 * Zod schemas for the `invoices` domain.
 *
 * Covers the CRUD endpoints and Verifactu submission helpers in
 * `app/(app)/invoices/actions.ts`.
 */

export const InvoiceStatus = z.enum(["draft", "issued", "paid", "overdue", "cancelled"]);
export type InvoiceStatusType = z.infer<typeof InvoiceStatus>;

export const InvoiceIdInput = uuidIdInput;

export const SendInvoiceInput = uuidIdInput;

export const CreateInvoiceFromProposalInput = z.object({
  proposalId: z.string().uuid(),
});
export type CreateInvoiceFromProposalInputType = z.infer<typeof CreateInvoiceFromProposalInput>;

/**
 * Generate a draft invoice for an hourly project from the hours logged in a
 * given calendar month. `month` is `YYYY-MM`.
 */
export const CreateMonthlyHourlyInvoiceInput = z.object({
  projectId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes no válido (YYYY-MM)"),
});
export type CreateMonthlyHourlyInvoiceInputType = z.infer<typeof CreateMonthlyHourlyInvoiceInput>;

export const UpdateInvoiceInput = z.object({
  id: z.string().uuid(),
  issue_date: z.string().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  items: z.array(lineItemInput).min(1).optional(),
});
export type UpdateInvoiceInputType = z.input<typeof UpdateInvoiceInput>;

export const UpdateInvoiceStatusInput = z.object({
  id: z.string().uuid(),
  status: InvoiceStatus,
});
export type UpdateInvoiceStatusInputType = z.infer<typeof UpdateInvoiceStatusInput>;
