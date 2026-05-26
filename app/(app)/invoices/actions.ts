"use server";

import { requireRole } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { submitToVerifactu } from "@/lib/verifactu/client";
import { buildQrUrl } from "@/lib/verifactu/qr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const log = scopedLogger("invoices.actions");

const SendInput = z.object({ id: z.string().uuid() });

type ActionResult = { ok: true; csv: string | null } | { ok: false; error: string };

/**
 * Sends an invoice to Verifactu (AEAT). Computes the SHA-256 hash chain entry
 * using the previous invoice in `chain_sequence` order, builds the IDFACT and
 * QR URL, submits via `submitToVerifactu`, and persists the result.
 *
 * Only `owner` and `admin` can trigger this. Idempotent on the row: if the
 * invoice is already `accepted`, the call short-circuits.
 */
export async function sendToAeat(formData: FormData): Promise<ActionResult> {
  await requireRole(["owner", "admin"]);
  const env = serverEnv();

  const parsed = SendInput.safeParse({ id: formData.get("id")?.toString() ?? "" });
  if (!parsed.success) return { ok: false, error: "ID inválido" };
  const { id } = parsed.data;

  if (!env.VERIFACTU_NIF_EMISOR) {
    return { ok: false, error: "Falta VERIFACTU_NIF_EMISOR en el entorno" };
  }

  const supabase = await createServerClient();

  const { data: invoice, error: readError } = await supabase
    .from("invoices")
    .select(
      "id, status, verifactu_status, full_number, invoice_type, issue_date, tax_amount, total, previous_hash, chain_sequence",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (readError || !invoice) {
    return { ok: false, error: "Factura no encontrada" };
  }
  if (invoice.status === "draft") {
    return { ok: false, error: "Emite la factura antes de enviarla a la AEAT" };
  }
  if (invoice.verifactu_status === "accepted") {
    return { ok: true, csv: null };
  }
  if (invoice.verifactu_status === "excluded") {
    return { ok: false, error: "Esta factura está excluida de Verifactu" };
  }

  // Resolve previous hash from the latest accepted invoice in the chain.
  const { data: prev } = await supabase
    .from("invoices")
    .select("current_hash, chain_sequence")
    .eq("verifactu_status", "accepted")
    .not("current_hash", "is", null)
    .order("chain_sequence", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const previousHash = (prev?.current_hash as string | null) ?? null;
  const nextSequence = ((prev?.chain_sequence as number | null) ?? 0) + 1;
  const generatedAt = new Date();
  const issueDate = new Date(invoice.issue_date as string);

  const result = await submitToVerifactu({
    nif: env.VERIFACTU_NIF_EMISOR,
    invoiceNumber: invoice.full_number as string,
    invoiceType: invoice.invoice_type as string,
    issueDate,
    taxAmount: Number(invoice.tax_amount ?? 0),
    total: Number(invoice.total ?? 0),
    previousHash,
    generatedAt,
  });

  const qrUrl = buildQrUrl(
    {
      nif: env.VERIFACTU_NIF_EMISOR,
      invoiceNumber: invoice.full_number as string,
      issueDate,
      total: Number(invoice.total ?? 0),
    },
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  );

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      idfact: result.idfact,
      previous_hash: previousHash,
      current_hash: result.hash,
      chain_sequence: result.status === "accepted" ? nextSequence : null,
      hash_generated_at: generatedAt.toISOString(),
      verifactu_status: result.status === "accepted" ? "accepted" : "rejected",
      verifactu_submitted_at: generatedAt.toISOString(),
      verifactu_csv: result.csv,
      verifactu_response: result.response,
      qr_url: qrUrl,
      issued_at: invoice.verifactu_status === "pending" ? generatedAt.toISOString() : undefined,
    })
    .eq("id", id);

  if (updateError) {
    log.error({ err: updateError, invoiceId: id }, "verifactu_persist_failed");
    return { ok: false, error: updateError.message };
  }

  log.info({ invoiceId: id, csv: result.csv, status: result.status }, "verifactu_submit_done");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/inicio");

  if (result.status !== "accepted") {
    return { ok: false, error: result.errorMessage ?? "AEAT rechazó la factura" };
  }
  return { ok: true, csv: result.csv };
}
