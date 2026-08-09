import {
  createVerifactuClient,
  type VerifactuSubmitInput,
  type VerifactuSubmitResult,
} from "@doscientos/verifactu";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifactuConfigFromEnv } from "./config";

const log = scopedLogger("verifactu.outbox");

type Rpc = (
  functionName: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

type LedgerRow = {
  record_type: "alta" | "anulacion";
  current_hash: string;
  record_payload: Record<string, unknown>;
};

type CancellationInput = {
  nif: string;
  cancelledInvoiceNumber: string;
  cancelledInvoiceIssueDate: Date;
  previousHash: string | null;
  generatedAt: Date;
  emisorName: string;
  previousInvoiceNumber: string | null;
  previousIssueDate: Date | null;
  sinRegistroPrevio: "S" | "N";
  rechazoPrevio: "S" | "N";
};

type DurablePackage = {
  computeInvoiceHash?: (input: VerifactuSubmitInput) => string;
  computeCancellationHash?: (input: CancellationInput) => string;
};

type CancellableClient = {
  cancelInvoice?: (input: CancellationInput) => Promise<VerifactuSubmitResult>;
};

export type OutboxDelivery = {
  processed: boolean;
  status: "accepted" | "rejected" | "error" | "skipped";
  csv: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El registro fiscal almacenado no tiene un formato válido");
  }
  return value as Record<string, unknown>;
}

function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${key} en el registro fiscal`);
  }
  return value;
}

function nullableText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Falta ${key} en el registro fiscal`);
  }
  return value;
}

function dateValue(payload: Record<string, unknown>, key: string): Date {
  const date = new Date(text(payload, key));
  if (Number.isNaN(date.getTime())) throw new Error(`${key} no contiene una fecha válida`);
  return date;
}

function toAltaInput(payload: Record<string, unknown>): VerifactuSubmitInput {
  const lines = payload.vatLines;
  if (!Array.isArray(lines)) throw new Error("Falta el desglose de IVA del registro fiscal");

  return {
    nif: text(payload, "nif"),
    invoiceNumber: text(payload, "invoiceNumber"),
    invoiceType: text(payload, "invoiceType"),
    issueDate: dateValue(payload, "issueDate"),
    taxAmount: numberValue(payload, "taxAmount"),
    total: numberValue(payload, "total"),
    previousHash: nullableText(payload, "previousHash"),
    generatedAt: dateValue(payload, "generatedAt"),
    emisorName: text(payload, "emisorName"),
    clientNif: nullableText(payload, "clientNif"),
    clientName: nullableText(payload, "clientName"),
    descriptionOperacion: text(payload, "descriptionOperacion"),
    vatLines: lines.map((line) => {
      const value = asRecord(line);
      return {
        rate: numberValue(value, "rate"),
        base: numberValue(value, "base"),
        tax: numberValue(value, "tax"),
      };
    }),
    previousInvoiceNumber: nullableText(payload, "previousInvoiceNumber"),
    previousIssueDate: payload.previousIssueDate ? dateValue(payload, "previousIssueDate") : null,
  };
}

function toCancellationInput(payload: Record<string, unknown>): CancellationInput {
  const sinRegistroPrevio = payload.sinRegistroPrevio === "S" ? "S" : "N";
  const rechazoPrevio = payload.rechazoPrevio === "S" ? "S" : "N";
  return {
    nif: text(payload, "nif"),
    cancelledInvoiceNumber: text(payload, "cancelledInvoiceNumber"),
    cancelledInvoiceIssueDate: dateValue(payload, "cancelledInvoiceIssueDate"),
    previousHash: nullableText(payload, "previousHash"),
    generatedAt: dateValue(payload, "generatedAt"),
    emisorName: text(payload, "emisorName"),
    previousInvoiceNumber: nullableText(payload, "previousInvoiceNumber"),
    previousIssueDate: payload.previousIssueDate ? dateValue(payload, "previousIssueDate") : null,
    sinRegistroPrevio,
    rechazoPrevio,
  };
}

export async function assertDurableVerifactuPackage(): Promise<Required<DurablePackage>> {
  const packageApi = (await import("@doscientos/verifactu")) as unknown as DurablePackage;
  if (!packageApi.computeInvoiceHash || !packageApi.computeCancellationHash) {
    throw new Error("Falta @doscientos/verifactu 0.1.11 con soporte de ledger durable");
  }
  return packageApi as Required<DurablePackage>;
}

function sanitizeResponse(response: Record<string, unknown>): Record<string, unknown> {
  const allowed = [
    "kind",
    "httpStatus",
    "csv",
    "aeatCode",
    "aeatDescription",
    "soapFault",
    "error",
  ];
  return Object.fromEntries(
    allowed.filter((key) => response[key] !== undefined).map((key) => [key, response[key]]),
  );
}

async function complete(
  rpc: Rpc,
  outboxId: string,
  workerId: string,
  result: VerifactuSubmitResult | null,
  error: string | null,
): Promise<OutboxDelivery> {
  const status = result?.status ?? "error";
  const { error: completionError } = await rpc("complete_verifactu_outbox", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
    p_result: status,
    p_csv: result?.csv ?? null,
    p_aeat_code: result?.aeatCode ?? null,
    p_response: result ? sanitizeResponse(result.response) : null,
    p_error: error ?? result?.errorMessage ?? null,
  });
  if (completionError) throw new Error(completionError.message);
  return { processed: true, status, csv: result?.csv ?? null };
}

/** Deliver one already-created fiscal record. Safe to call concurrently. */
export async function deliverVerifactuOutbox(
  outboxId: string,
  workerId: string,
): Promise<OutboxDelivery> {
  const admin = createAdminClient();
  const rpc = admin.rpc.bind(admin) as unknown as Rpc;
  const { data: ledgerId, error: claimError } = await rpc("claim_verifactu_outbox", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
  });
  if (claimError) throw new Error(claimError.message);
  if (typeof ledgerId !== "string") return { processed: false, status: "skipped", csv: null };

  const { data, error: ledgerError } = await admin
    .from("verifactu_ledger")
    .select("record_type, current_hash, record_payload")
    .eq("id", ledgerId)
    .single();
  if (ledgerError || !data)
    throw new Error(ledgerError?.message ?? "Registro fiscal no encontrado");

  const ledger = data as unknown as LedgerRow;
  try {
    const payload = asRecord(ledger.record_payload);
    const api = await assertDurableVerifactuPackage();
    const client = createVerifactuClient(verifactuConfigFromEnv(), log);
    let result: VerifactuSubmitResult;
    if (ledger.record_type === "alta") {
      const input = toAltaInput(payload);
      if (api.computeInvoiceHash(input) !== ledger.current_hash) {
        throw new Error("La huella del RegistroAlta no coincide con el ledger");
      }
      result = await client.registerInvoice(input);
    } else {
      const cancellationClient = client as typeof client & CancellableClient;
      if (!cancellationClient.cancelInvoice) {
        throw new Error("Falta @doscientos/verifactu 0.1.11 con RegistroAnulacion");
      }
      const input = toCancellationInput(payload);
      if (api.computeCancellationHash(input) !== ledger.current_hash) {
        throw new Error("La huella del RegistroAnulacion no coincide con el ledger");
      }
      result = await cancellationClient.cancelInvoice(input);
    }
    if (result.hash !== ledger.current_hash) {
      throw new Error("La huella devuelta por VERI*FACTU no coincide con el ledger");
    }
    return await complete(rpc, outboxId, workerId, result, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al enviar a AEAT";
    log.error({ err: error, outboxId, ledgerId }, "verifactu_outbox_delivery_failed");
    return complete(rpc, outboxId, workerId, null, message);
  }
}

/** Re-deliver the RegistroAlta belonging to an invoice, if it is due. */
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
    .maybeSingle();
  if (ledgerError) throw new Error(ledgerError.message);
  const ledgerId = (ledger as { id?: unknown } | null)?.id;
  if (typeof ledgerId !== "string") {
    throw new Error("La factura no tiene un registro fiscal durable");
  }

  const { data: outbox, error: outboxError } = await admin
    .from("verifactu_outbox")
    .select("id")
    .eq("ledger_id", ledgerId)
    .maybeSingle();
  if (outboxError) throw new Error(outboxError.message);
  const outboxId = (outbox as { id?: unknown } | null)?.id;
  if (typeof outboxId !== "string") throw new Error("No se encontró la cola de envío fiscal");
  return deliverVerifactuOutbox(outboxId, workerId);
}

/** Persist the QR built from the immutable RegistroAlta snapshot. */
export async function syncInvoiceQrFromLedger(invoiceId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("verifactu_ledger")
    .select("record_payload")
    .eq("invoice_id", invoiceId)
    .eq("record_type", "alta")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se encontró el RegistroAlta para generar el QR");

  const input = toAltaInput(asRecord((data as { record_payload?: unknown }).record_payload));
  const qrUrl = createVerifactuClient(verifactuConfigFromEnv()).buildQrUrl({
    nif: input.nif,
    invoiceNumber: input.invoiceNumber,
    issueDate: input.issueDate,
    total: input.total,
  });
  const { error: updateError } = await admin
    .from("invoices")
    .update({ qr_url: qrUrl })
    .eq("id", invoiceId);
  if (updateError) throw new Error(updateError.message);
}

/** Claim and deliver due records serially to preserve the fiscal chain order. */
export async function retryDueVerifactuOutbox(limit = 10): Promise<OutboxDelivery[]> {
  const admin = createAdminClient();
  const rpc = admin.rpc.bind(admin) as unknown as Rpc;
  const workerId = `cron:${crypto.randomUUID()}`;
  const results: OutboxDelivery[] = [];

  for (let index = 0; index < Math.min(Math.max(limit, 1), 25); index += 1) {
    const { data, error } = await rpc("claim_due_verifactu_outboxes", {
      p_limit: 1,
      p_worker_id: workerId,
    });
    if (error) throw new Error(error.message);
    const claimed = Array.isArray(data) ? data[0] : null;
    const outboxId =
      claimed && typeof claimed === "object"
        ? (claimed as { outbox_id?: unknown }).outbox_id
        : null;
    if (typeof outboxId !== "string") break;
    results.push(await deliverVerifactuOutbox(outboxId, workerId));
  }
  return results;
}
