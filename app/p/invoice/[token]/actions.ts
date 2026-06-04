"use server";

import { unlockPortalResource } from "@/lib/portal/access";

type ActionResult = { ok: true } | { ok: false; error: string };

/** Public unlock-form submit for a password-protected invoice portal link. */
export async function unlockInvoicePortal(input: unknown): Promise<ActionResult> {
  return unlockPortalResource("invoices", input);
}
