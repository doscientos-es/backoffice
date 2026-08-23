import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type VerifactuConfig,
  type VerifactuSubmitResult,
} from "@doscientos/verifactu";
import {
  formatVerifactuDeliveryError,
  isRetryableVerifactuDelivery,
  normalizeAltaRechazoPrevio,
  parseDurableAltaPayload,
  prepareDurableVerifactuRecord,
  resolveVerifactuSoftwareSnapshot,
  sanitizeVerifactuResponse,
  verifactuWaitSeconds,
} from "@doscientos/verifactu/durable";
import { verifactuInvoiceConfigFromEnv } from "./config";

export {
  isRetryableVerifactuDelivery,
  normalizeAltaRechazoPrevio,
  resolveVerifactuSoftwareSnapshot
};

export const formatOutboxError = formatVerifactuDeliveryError;

const log = scopedLogger("verifactu.outbox");

/**
 * The VERI*FACTU package includes an optional native XML validator. Keep it out
 * of unrelated Server Action bundles (such as proposal detail) and load it
 * only when a fiscal delivery or QR generation is actually requested.
 */
async function createVerifactuClient(config: VerifactuConfig) {
  const { createVerifactuClient } = await import("@doscientos/verifactu");
  return createVerifactuClient(config, log);
}

type LedgerRow = {
  record_type: "alta" | "anulacion";
  issuer_nif: string;
  current_hash: string;
  record_payload: Record<string, unknown>;
};

export type OutboxDelivery = {
  processed: boolean;
  status: VerifactuSubmitResult["status"] | "skipped" | "deferred";
  csv: string | null;
  /** Last actionable delivery error, preserved for the retry UI. */
  error?: string | null;
  warnings: Array<{ code: string | null; message: string }>;
};

export const MISSING_DURABLE_FISCAL_RECORD_MESSAGE =
  "Esta factura es anterior al registro fiscal durable y requiere regularización antes de enviarla a AEAT.";
export const REJECTED_RECORD_REQUIRES_REGULARIZATION_MESSAGE =
  "AEAT rechazó este registro. No se puede reenviar el mismo RegistroAlta; usa «Regularizar y enviar».";
export const TERMINAL_RECORD_REQUIRES_REGULARIZATION_MESSAGE =
  "Este registro tiene un error definitivo y no admite reintentos. Usa «Regularizar y enviar» después de corregir la causa indicada.";

/** Fails closed until the package carrying durable-flow support is deployed. */
export async function assertDurableVerifactuPackage(requireCancellation = false): Promise<void> {
  const pkg = await import("@doscientos/verifactu");
  if (typeof pkg.prepareDurableVerifactuRecord !== "function") {
    throw new Error("El paquete @doscientos/verifactu no implementa el motor durable requerido");
  }
  if (!requireCancellation) return;
  const client = await createVerifactuClient(verifactuInvoiceConfigFromEnv());
  if (
    typeof client.cancelInvoice !== "function" ||
    typeof pkg.computeCancellationHash !== "function"
  ) {
    throw new Error("El paquete @doscientos/verifactu no implementa RegistroAnulacion durable");
  }
}

async function getLedger(ledgerId: string): Promise<LedgerRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("verifactu_ledger")
    .select("record_type, issuer_nif, current_hash, record_payload")
    .eq("id", ledgerId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Registro fiscal no encontrado");
  const row = data as unknown as LedgerRow;
  if (
    !row.record_payload ||
    typeof row.record_payload !== "object" ||
    Array.isArray(row.record_payload)
  ) {
    throw new Error("El registro fiscal no contiene un payload válido");
  }
  return row;
}

async function outboxIncident(outboxId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("verifactu_outbox")
    .select("incidence")
    .eq("id", outboxId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message ?? "Outbox VERI*FACTU no encontrado");
  const row = data as { incidence?: unknown };
  return row.incidence === true;
}

async function complete(
  outboxId: string,
  workerId: string,
  result: VerifactuSubmitResult | null,
  error?: unknown,
): Promise<OutboxDelivery> {
  const admin = createAdminClient();
  const status = result?.status ?? "error";
  const explicitError = error instanceof Error ? error.message : "Error de envío a AEAT";
  const message = formatOutboxError(error ? explicitError : null, result);
  const enrichedResponse = result
    ? sanitizeVerifactuResponse({
      ...result.response,
      errorCode: result.errorCode,
      aeatStatus: (result as VerifactuSubmitResult & { aeatStatus?: unknown }).aeatStatus,
      warnings: (result as VerifactuSubmitResult & { warnings?: unknown }).warnings,
    })
    : { kind: "delivery_error" };
  const { error: completionError } = await admin.rpc("complete_verifactu_outbox_v2", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
    p_result: status,
    p_csv: result?.csv ?? null,
    p_aeat_code: result?.aeatCode ?? null,
    p_response: enrichedResponse,
    p_error: message,
    p_retryable: isRetryableVerifactuDelivery(result),
    p_wait_seconds: verifactuWaitSeconds(result),
  });
  if (completionError) throw new Error(completionError.message);
  return {
    processed: true,
    status,
    csv: result?.csv ?? null,
    error: message,
    warnings:
      (
        result as
        | (VerifactuSubmitResult & { warnings?: Array<{ code: string | null; message: string }> })
        | null
      )?.warnings ?? [],
  };
}

async function deliverClaimed(
  outboxId: string,
  ledgerId: string,
  workerId: string,
): Promise<OutboxDelivery> {
  try {
    const ledger = await getLedger(ledgerId);
    const config = verifactuInvoiceConfigFromEnv();
    const incidence = await outboxIncident(outboxId);
    const admin = createAdminClient();
    const { data: slot, error: slotError } = await admin.rpc("reserve_verifactu_submission_slot", {
      p_issuer_nif: ledger.issuer_nif,
    });
    if (slotError) throw new Error(slotError.message);
    const reservation = (Array.isArray(slot) ? slot[0] : slot) as {
      allowed?: unknown;
      next_allowed_at?: unknown;
    } | null;
    if (reservation?.allowed !== true) {
      const next = reservation?.next_allowed_at;
      if (typeof next !== "string") throw new Error("Control de flujo AEAT inválido");
      const { error: deferError } = await admin.rpc("defer_verifactu_outbox", {
        p_outbox_id: outboxId,
        p_worker_id: workerId,
        p_next_attempt_at: next,
      });
      if (deferError) throw new Error(deferError.message);
      return {
        processed: false,
        status: "deferred",
        csv: null,
        error: "El envío se ha aplazado para respetar el control de flujo de AEAT.",
        warnings: [],
      };
    }
    const prepared = prepareDurableVerifactuRecord(
      {
        recordType: ledger.record_type,
        currentHash: ledger.current_hash,
        payload: ledger.record_payload,
        incidence,
      },
      config.software,
    );
    const client = await createVerifactuClient({ ...config, software: prepared.software });
    let result: VerifactuSubmitResult;

    if (prepared.recordType === "alta") {
      result = await client.registerInvoice(prepared.input);
    } else {
      result = await client.cancelInvoice(prepared.input);
    }
    if (result.hash !== ledger.current_hash) {
      throw new Error("La huella devuelta por VERI*FACTU no coincide con el ledger");
    }
    return await complete(outboxId, workerId, result);
  } catch (error) {
    log.error({ err: error, outboxId, ledgerId }, "verifactu_outbox_delivery_failed");
    return complete(outboxId, workerId, null, error);
  }
}

/** Claims and delivers a known outbox row. Safe when another worker won the race. */
export async function deliverVerifactuOutbox(
  outboxId: string,
  workerId: string,
): Promise<OutboxDelivery> {
  const admin = createAdminClient();
  const { data: ledgerId, error } = await admin.rpc("claim_verifactu_outbox", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
  });
  if (error) throw new Error(error.message);
  if (!ledgerId) {
    return {
      processed: false,
      status: "skipped",
      csv: null,
      error: "El registro anterior de la cadena aún no ha sido aceptado por AEAT.",
      warnings: [],
    };
  }
  return deliverClaimed(outboxId, ledgerId as string, workerId);
}

/** Re-delivers the immutable RegistroAlta for one invoice, if it has one. */
export async function deliverInvoiceVerifactu(
  invoiceId: string,
  workerId: string,
): Promise<OutboxDelivery> {
  const admin = createAdminClient();
  const { data: ledger, error: ledgerError } = await admin
    .from("verifactu_ledger")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("record_type", "alta")
    .order("chain_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ledgerError) throw new Error(ledgerError.message);
  const ledgerId = (ledger as { id?: unknown } | null)?.id;
  if (typeof ledgerId !== "string") throw new Error(MISSING_DURABLE_FISCAL_RECORD_MESSAGE);

  const { data: outbox, error: outboxError } = await admin
    .from("verifactu_outbox")
    .select("id, state, next_attempt_at, aeat_csv, last_error")
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (outboxError) throw new Error(outboxError.message);
  const outboxRow = outbox as {
    id?: unknown;
    state?: unknown;
    next_attempt_at?: unknown;
    aeat_csv?: unknown;
    last_error?: unknown;
  } | null;
  const outboxId = outboxRow?.id;
  if (typeof outboxId !== "string") throw new Error("No se encontró la cola de envío fiscal");
  if (outboxRow?.state === "rejected") {
    return {
      processed: false,
      status: "rejected",
      csv: null,
      error: REJECTED_RECORD_REQUIRES_REGULARIZATION_MESSAGE,
      warnings: [],
    };
  }
  if (outboxRow?.state === "terminal_error") {
    return {
      processed: false,
      status: "error",
      csv: null,
      error:
        typeof outboxRow.last_error === "string" && outboxRow.last_error.trim()
          ? `${TERMINAL_RECORD_REQUIRES_REGULARIZATION_MESSAGE} Causa: ${outboxRow.last_error}`
          : TERMINAL_RECORD_REQUIRES_REGULARIZATION_MESSAGE,
      warnings: [],
    };
  }
  if (outboxRow?.state === "accepted") {
    return {
      processed: false,
      status: "accepted",
      csv: typeof outboxRow.aeat_csv === "string" ? outboxRow.aeat_csv : null,
      error: null,
      warnings: [],
    };
  }
  if (outboxRow?.state === "processing") {
    return {
      processed: false,
      status: "skipped",
      csv: null,
      error: "AEAT ya está procesando este registro. No es necesario volver a enviarlo.",
      warnings: [],
    };
  }
  if (
    outboxRow?.state === "retryable_error" &&
    typeof outboxRow.next_attempt_at === "string" &&
    new Date(outboxRow.next_attempt_at).getTime() > Date.now()
  ) {
    return {
      processed: false,
      status: "deferred",
      csv: null,
      error: "El reintento automático ya está programado y todavía no corresponde ejecutarlo.",
      warnings: [],
    };
  }
  return deliverVerifactuOutbox(outboxId, workerId);
}

/** Generates the invoice QR from the immutable RegistroAlta snapshot. */
export async function syncInvoiceQrFromLedger(invoiceId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("verifactu_ledger")
    .select("record_payload")
    .eq("invoice_id", invoiceId)
    .eq("record_type", "alta")
    .order("chain_sequence", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data)
    throw new Error(error?.message ?? "No se encontró el RegistroAlta para generar el QR");

  const input = parseDurableAltaPayload(
    (data as { record_payload: Record<string, unknown> }).record_payload,
  );
  const client = await createVerifactuClient(verifactuInvoiceConfigFromEnv());
  const qrUrl = client.buildQrUrl({
    nif: input.nif as string,
    invoiceNumber: input.invoiceNumber as string,
    issueDate: input.issueDate as Date,
    total: input.total as number,
  });
  const { error: updateError } = await admin
    .from("invoices")
    .update({ qr_url: qrUrl })
    .eq("id", invoiceId);
  if (updateError) throw new Error(updateError.message);
}

/** Processes due work sequentially so AEAT sees each hash-chain entry in order. */
export async function retryDueVerifactuOutbox(limit = 10): Promise<OutboxDelivery[]> {
  const admin = createAdminClient();
  const results: OutboxDelivery[] = [];
  const workerId = `cron:${crypto.randomUUID()}`;
  for (let count = 0; count < Math.min(Math.max(limit, 1), 50); count += 1) {
    const { data, error } = await admin.rpc("claim_due_verifactu_outboxes", {
      p_limit: 1,
      p_worker_id: workerId,
    });
    if (error) throw new Error(error.message);
    const job = (data as { outbox_id: string; ledger_id: string }[] | null)?.[0];
    if (!job) break;
    results.push(await deliverClaimed(job.outbox_id, job.ledger_id, workerId));
  }
  return results;
}
