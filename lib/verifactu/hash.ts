import { createHash } from "node:crypto";

/**
 * Verifactu / SIF hash chain (Anexo I, Orden HAC/1177/2024).
 *
 * Each invoice's `current_hash` is SHA-256 of the concatenated fiscal fields
 * separated by `|`, where the issue date is formatted DD-MM-YYYY.
 * The first invoice of the chain uses '0' as `previous_hash`.
 */
export type HashInput = {
  nif: string;
  invoiceNumber: string;
  invoiceType: string;
  issueDate: Date;
  taxAmount: number;
  total: number;
  previousHash: string | null;
  generatedAt: Date;
};

function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getUTCFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function n2(x: number): string {
  return x.toFixed(2);
}

function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildHashPayload(input: HashInput): string {
  const previous = input.previousHash && input.previousHash.length > 0 ? input.previousHash : "0";
  return [
    input.nif,
    input.invoiceNumber,
    input.invoiceType,
    ddmmyyyy(input.issueDate),
    n2(input.taxAmount),
    n2(input.total),
    previous,
    isoSeconds(input.generatedAt),
  ].join("|");
}

export function computeInvoiceHash(input: HashInput): string {
  return createHash("sha256").update(buildHashPayload(input), "utf8").digest("hex");
}
