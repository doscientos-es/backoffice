import {
  createVerifactuClient,
  type VerifactuSoftware,
  type VerifactuSubmitInput,
  type VerifactuSubmitResult,
} from "@doscientos/verifactu";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifactuConfigFromEnv } from "./config";

const log = scopedLogger("verifactu.outbox");

type LedgerRow = {
  record_type: "alta" | "anulacion";
  issuer_nif: string;
  current_hash: string;
  record_payload: Record<string, unknown>;
};

type HashModule = {
  computeInvoiceHash?: (input: VerifactuSubmitInput) => string;
  computeCancellationHash?: (input: CancellationInput) => string;
};

type CancellableClient = {
  cancelInvoice?: (input: CancellationInput) => Promise<VerifactuSubmitResult>;
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
  incidence?: boolean;
};

export type OutboxDelivery = {
  processed: boolean;
  status: VerifactuSubmitResult["status"] | "skipped" | "deferred";
  csv: string | null;
  warnings: Array<{ code: string | null; message: string }>;
};

export const MISSING_DURABLE_FISCAL_RECORD_MESSAGE =
  "Esta factura es anterior al registro fiscal durable y requiere regularización antes de enviarla a AEAT.";

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El registro fiscal almacenado no tiene un formato válido");
  }
  return value as Record<string, unknown>;
}

function text(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`Payload fiscal inválido: ${key}`);
  return value;
}

function amount(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Payload fiscal inválido: ${key}`);
  }
  return value;
}

function date(payload: Record<string, unknown>, key: string): Date {
  const value = new Date(text(payload, key));
  if (Number.isNaN(value.getTime())) throw new Error(`Fecha fiscal inválida: ${key}`);
  return value;
}

function nullableDate(payload: Record<string, unknown>, key: string): Date | null {
  const value = payload[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Fecha fiscal inválida: ${key}`);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Fecha fiscal inválida: ${key}`);
  return parsed;
}

function nullableText(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`Payload fiscal inválido: ${key}`);
  return value;
}

function optionalEnum<T extends string>(
  payload: Record<string, unknown>,
  key: string,
  values: readonly T[],
): T | undefined {
  const value = payload[key];
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`Payload fiscal inválido: ${key}`);
  }
  return value as T;
}

function references(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (value === null || value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`Payload fiscal inválido: ${key}`);
  return value.map((entry) => {
    const row = asRecord(entry);
    return { invoiceNumber: text(row, "invoiceNumber"), issueDate: date(row, "issueDate") };
  });
}

function sanitizeResponse(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { kind: "unknown_response" };
  }
  const allowed = [
    "kind",
    "httpStatus",
    "csv",
    "aeatCode",
    "aeatDescription",
    "soapFault",
    "waitSeconds",
    "error",
    "errorCode",
    "aeatStatus",
    "warnings",
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => (response as Record<string, unknown>)[key] !== undefined)
      .map((key) => [key, (response as Record<string, unknown>)[key]]),
  );
}

export function formatOutboxError(
  explicitError: string | null,
  result: Pick<VerifactuSubmitResult, "aeatCode" | "errorMessage"> | null,
): string | null {
  const message = explicitError ?? result?.errorMessage ?? null;
  if (!result?.aeatCode) return message;
  return message ? `AEAT ${result.aeatCode}: ${message}` : `AEAT ${result.aeatCode}`;
}

/** Fails closed until the package carrying durable-flow support is deployed. */
export async function assertDurableVerifactuPackage(requireCancellation = false): Promise<void> {
  const hashes = (await import("@doscientos/verifactu")) as unknown as HashModule;
  if (!hashes.computeInvoiceHash) {
    throw new Error(
      "El paquete @doscientos/verifactu no implementa el cálculo de huella requerido por VERI*FACTU durable",
    );
  }
  if (!requireCancellation) return;
  const client = createVerifactuClient(verifactuConfigFromEnv()) as unknown as CancellableClient;
  if (!client.cancelInvoice || !hashes.computeCancellationHash) {
    throw new Error("El paquete @doscientos/verifactu no implementa RegistroAnulacion durable");
  }
}

function altaInput(payload: Record<string, unknown>): VerifactuSubmitInput {
  const vatLines = payload.vatLines;
  if (!Array.isArray(vatLines)) throw new Error("Payload fiscal inválido: vatLines");
  const input = {
    nif: text(payload, "nif"),
    invoiceNumber: text(payload, "invoiceNumber"),
    invoiceType: text(payload, "invoiceType"),
    externalReference: nullableText(payload, "externalReference") ?? undefined,
    rectificationType: optionalEnum(payload, "rectificationMethod", ["S", "I"] as const),
    rectifiedInvoices: references(payload, "rectifiedInvoices") ?? (
      payload.rectifiedInvoiceNumber
        ? [{
            invoiceNumber: text(payload, "rectifiedInvoiceNumber"),
            issueDate: date(payload, "rectifiedInvoiceIssueDate"),
          }]
        : undefined
    ),
    rectificationAmounts:
      payload.rectificationAmounts && typeof payload.rectificationAmounts === "object"
        ? (() => {
            const value = asRecord(payload.rectificationAmounts);
            return {
              base: amount(value, "base"),
              tax: amount(value, "tax"),
              surcharge: value.surcharge === undefined ? undefined : amount(value, "surcharge"),
            };
          })()
        : undefined,
    operationDate: payload.operationDate ? date(payload, "operationDate") : undefined,
    subsanacion: optionalEnum(payload, "subsanacion", ["S", "N"] as const),
    rechazoPrevio: optionalEnum(payload, "rechazoPrevio", ["N", "S", "X"] as const),
    issueDate: date(payload, "issueDate"),
    taxAmount: amount(payload, "taxAmount"),
    total: amount(payload, "total"),
    previousHash: nullableText(payload, "previousHash"),
    generatedAt: date(payload, "generatedAt"),
    emisorName: text(payload, "emisorName"),
    clientNif: nullableText(payload, "clientNif"),
    clientName: nullableText(payload, "clientName"),
    descriptionOperacion: text(payload, "descriptionOperacion"),
    vatLines: vatLines.map((line) => {
      const value = asRecord(line);
      return {
        rate: amount(value, "rate"),
        base: amount(value, "base"),
        tax: amount(value, "tax"),
      };
    }),
    previousInvoiceNumber: nullableText(payload, "previousInvoiceNumber"),
    previousIssueDate: nullableDate(payload, "previousIssueDate"),
  };
  // Keep the adapter source-compatible with an older installed copy during a
  // rolling deployment; production must deploy @doscientos/verifactu >=0.1.12
  // so these fields are rendered into the AEAT XML.
  return input as VerifactuSubmitInput;
}

function cancellationInput(payload: Record<string, unknown>): CancellationInput {
  return {
    nif: text(payload, "nif"),
    cancelledInvoiceNumber: text(payload, "cancelledInvoiceNumber"),
    cancelledInvoiceIssueDate: date(payload, "cancelledInvoiceIssueDate"),
    previousHash: nullableText(payload, "previousHash"),
    generatedAt: date(payload, "generatedAt"),
    emisorName: text(payload, "emisorName"),
    previousInvoiceNumber: nullableText(payload, "previousInvoiceNumber"),
    previousIssueDate: nullableDate(payload, "previousIssueDate"),
    sinRegistroPrevio: payload.sinRegistroPrevio === "S" ? "S" : "N",
    rechazoPrevio: payload.rechazoPrevio === "S" ? "S" : "N",
  };
}

function softwareSnapshot(payload: Record<string, unknown>): VerifactuSoftware {
  const software = asRecord(payload.software);
  const boolean = (key: string): boolean => {
    const value = software[key];
    if (typeof value !== "boolean") throw new Error(`Payload fiscal inválido: software.${key}`);
    return value;
  };
  return {
    producerName: text(software, "producerName"),
    producerNif: text(software, "producerNif"),
    name: text(software, "name"),
    id: text(software, "id"),
    version: text(software, "version"),
    installationNumber: text(software, "installationNumber"),
    onlyVerifactu: boolean("onlyVerifactu"),
    multipleTaxpayers: boolean("multipleTaxpayers"),
  };
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

export function isRetryableVerifactuDelivery(result: VerifactuSubmitResult | null): boolean {
  if (result?.status !== "error") return false;
  if (result.errorCode === "network_error" || result.errorCode === "response_invalid") return true;
  if (result.errorCode !== "http_error") return false;
  const status = (result.response as { httpStatus?: unknown }).httpStatus;
  return typeof status === "number" && (status === 408 || status === 429 || status >= 500);
}

function waitSeconds(result: VerifactuSubmitResult | null): number | null {
  const value = (result?.response as { waitSeconds?: unknown } | undefined)?.waitSeconds;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
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
  const { error: completionError } = await admin.rpc("complete_verifactu_outbox_v2", {
    p_outbox_id: outboxId,
    p_worker_id: workerId,
    p_result: status,
    p_csv: result?.csv ?? null,
    p_aeat_code: result?.aeatCode ?? null,
    p_response: result
      ? sanitizeResponse({ ...result.response, errorCode: result.errorCode })
      : { kind: "delivery_error" },
    p_error: message,
    p_retryable: isRetryableVerifactuDelivery(result),
    p_wait_seconds: waitSeconds(result),
  });
  if (completionError) throw new Error(completionError.message);
  return { processed: true, status, csv: result?.csv ?? null };
}

async function deliverClaimed(
  outboxId: string,
  ledgerId: string,
  workerId: string,
): Promise<OutboxDelivery> {
  try {
    const ledger = await getLedger(ledgerId);
    const software = softwareSnapshot(ledger.record_payload);
    const hashes = (await import("@doscientos/verifactu")) as unknown as HashModule;
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
      return { processed: false, status: "deferred", csv: null };
    }
    const client = createVerifactuClient({ ...verifactuConfigFromEnv(), software }, log);
    let result: VerifactuSubmitResult;

    if (ledger.record_type === "alta") {
      const input = { ...altaInput(ledger.record_payload), incidence };
      const hash = hashes.computeInvoiceHash?.(input);
      if (!hash) throw new Error("Falta computeInvoiceHash en @doscientos/verifactu 0.1.12");
      if (hash !== ledger.current_hash)
        throw new Error("La huella del ledger no coincide con su payload");
      result = await client.registerInvoice(input);
    } else {
      const input = { ...cancellationInput(ledger.record_payload), incidence };
      const cancellable = client as unknown as CancellableClient;
      const hash = hashes.computeCancellationHash?.(input);
      if (!hash || !cancellable.cancelInvoice) {
        throw new Error("Falta RegistroAnulacion en @doscientos/verifactu 0.1.12");
      }
      if (hash !== ledger.current_hash)
        throw new Error("La huella de anulación no coincide con su payload");
      result = await cancellable.cancelInvoice(input);
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
  if (!ledgerId) return { processed: false, status: "skipped", csv: null };
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
    .maybeSingle();
  if (ledgerError) throw new Error(ledgerError.message);
  const ledgerId = (ledger as { id?: unknown } | null)?.id;
  if (typeof ledgerId !== "string") throw new Error(MISSING_DURABLE_FISCAL_RECORD_MESSAGE);

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

/** Generates the invoice QR from the immutable RegistroAlta snapshot. */
export async function syncInvoiceQrFromLedger(invoiceId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("verifactu_ledger")
    .select("record_payload")
    .eq("invoice_id", invoiceId)
    .eq("record_type", "alta")
    .maybeSingle();
  if (error || !data)
    throw new Error(error?.message ?? "No se encontró el RegistroAlta para generar el QR");

  const input = altaInput((data as { record_payload: Record<string, unknown> }).record_payload);
  const qrUrl = createVerifactuClient(verifactuConfigFromEnv()).buildQrUrl({
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
