"use server";

import { z } from "zod";

import { defineAction } from "@/lib/actions/define-action";
import {
  cancelInvoicePaymentFollowUp,
  rescheduleInvoicePaymentFollowUp,
} from "@/lib/invoices/payment-follow-ups";
import { createServerClient } from "@/lib/supabase/server";

const InvoiceAutomationInput = z.object({ invoiceId: z.string().uuid() });
const RescheduleInput = InvoiceAutomationInput.extend({
  runAt: z.string().datetime({ offset: true }),
});

export const cancelInvoicePaymentFollowUpAction = defineAction({
  name: "invoices.cancelPaymentFollowUp",
  schema: InvoiceAutomationInput,
  revalidate: (_payload, input) => [`/invoices/${input.invoiceId}`, "/invoices"],
  handler: async ({ invoiceId }) => {
    await cancelInvoicePaymentFollowUp(await createServerClient(), invoiceId);
  },
});

export const rescheduleInvoicePaymentFollowUpAction = defineAction({
  name: "invoices.reschedulePaymentFollowUp",
  schema: RescheduleInput,
  revalidate: (_payload, input) => [`/invoices/${input.invoiceId}`, "/invoices"],
  handler: async ({ invoiceId, runAt }) => {
    await rescheduleInvoicePaymentFollowUp(await createServerClient(), invoiceId, runAt);
  },
});
