import { z } from 'zod'

import { lineItemInput, uuidIdInput } from './common'

/**
 * Zod schemas for the `invoices` domain.
 *
 * Covers the CRUD endpoints and Verifactu submission helpers in
 * `app/(app)/invoices/actions.ts`.
 */

export const InvoiceStatus = z.enum([
  'draft',
  'issued',
  'paid',
  'overdue',
  'cancelled',
  'rectified',
])

export const InvoiceIdInput = uuidIdInput

export const SendInvoiceInput = uuidIdInput

/**
 * Input for emailing the public portal link of an invoice to the client.
 * `to` overrides the client's stored email; `message` is an optional note.
 * `attachPdf` attaches the generated invoice PDF to the email.
 */
export const SendInvoiceEmailInput = z.object({
  id: z.string().uuid(),
  to: z.string().email().optional(),
  message: z.string().max(1000).optional(),
  attachPdf: z.boolean().optional(),
})

/** Input for rendering the invoice email without delivering it. */
export const PreviewInvoiceEmailInput = SendInvoiceEmailInput.pick({ id: true, message: true })

/**
 * Input for logging that the portal link was shared over WhatsApp. Delivery
 * happens in WhatsApp itself, so only the recipient phone is recorded.
 */
export const LogInvoiceWhatsappShareInput = z.object({
  id: z.string().uuid(),
  phone: z.string().min(6).max(30),
})

export const CreateInvoiceFromProposalInput = z.object({
  proposalId: z.string().uuid(),
})

/** Creates the missing draft invoices for the proposal's configured payment plan. */
export const CreateInvoicesFromProposalPlanInput = CreateInvoiceFromProposalInput

/**
 * Generate a draft invoice for an hourly project from the hours logged in a
 * given calendar month. `month` is `YYYY-MM`.
 */
export const CreateMonthlyHourlyInvoiceInput = z.object({
  projectId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mes no válido (YYYY-MM)'),
})

export const UpdateInvoiceInput = z.object({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  issue_date: z.string().optional(),
  due_date: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  payment_terms: z.string().max(4000).nullable().optional(),
  items: z.array(lineItemInput).min(1).optional(),
})

const PaymentMethod = z.enum(['transfer', 'card', 'bizum', 'cash', 'other'])
export type PaymentMethodType = z.infer<typeof PaymentMethod>

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  transfer: 'Transferencia bancaria',
  card: 'Tarjeta (Redsys)',
  bizum: 'Bizum',
  cash: 'Efectivo',
  other: 'Otro',
}

export const UpdateInvoiceStatusInput = z.object({
  id: z.string().uuid(),
  status: InvoiceStatus,
  paymentMethod: PaymentMethod.optional(),
})

export const RecordInvoicePaymentInput = z.object({
  id: z.string().uuid(),
  amount: z.coerce.number().finite().positive(),
  paymentMethod: PaymentMethod,
})

export const MarkUncollectibleInput = z.object({
  id: z.string().uuid(),
})

/**
 * Input for creating a rectification invoice (factura rectificativa).
 * Types R1/R4 are the most common for B2B invoices (RD 1619/2012 art.15).
 * R1 = error/devolución; R4 = otras causas.
 */
const RectificationType = z.enum(['R1', 'R4'])

export const CreateRectificationInput = z.object({
  originalInvoiceId: z.string().uuid(),
  rectificationType: RectificationType,
  reason: z.string().min(1, 'El motivo es obligatorio').max(500),
})
