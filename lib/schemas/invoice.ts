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
