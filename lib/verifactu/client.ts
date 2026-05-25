import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { computeInvoiceHash } from "@/lib/verifactu/hash";
import { buildIdfact } from "@/lib/verifactu/idfact";

const log = scopedLogger("verifactu");

export type VerifactuSubmitInput = {
  nif: string;
  invoiceNumber: string;
  invoiceType: string;
  issueDate: Date;
  taxAmount: number;
  total: number;
  previousHash: string | null;
  generatedAt: Date;
};

export type VerifactuSubmitResult = {
  status: "accepted" | "rejected" | "error";
  csv: string | null;
  hash: string;
  idfact: string;
  response: Record<string, unknown>;
  errorMessage: string | null;
};

/**
 * Build the SIF/Verifactu signed XML payload (Anexo I/II of HAC/1177/2024).
 *
 * NOTE: This is a minimal serializer for MVP/mock mode. The real XAdES-EPES
 * signature and full RegistroAlta schema are deferred to the prod adapter
 * (see `submitProd` below). The output is deterministic so it can be hashed
 * for audit purposes.
 */
export function buildVerifactuXml(input: VerifactuSubmitInput, hash: string): string {
  const ts = input.generatedAt.toISOString();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sum:RegFactuSistemaFacturacion xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">',
    "  <sum:Cabecera>",
    "    <sum:ObligadoEmision>",
    `      <sum:NIF>${input.nif}</sum:NIF>`,
    "    </sum:ObligadoEmision>",
    "  </sum:Cabecera>",
    "  <sum:RegistroFactura>",
    "    <sum:RegistroAlta>",
    "      <sum:IDFactura>",
    `        <sum:IDEmisorFactura>${input.nif}</sum:IDEmisorFactura>`,
    `        <sum:NumSerieFactura>${input.invoiceNumber}</sum:NumSerieFactura>`,
    `        <sum:FechaExpedicionFactura>${input.issueDate.toISOString().slice(0, 10)}</sum:FechaExpedicionFactura>`,
    "      </sum:IDFactura>",
    `      <sum:TipoFactura>${input.invoiceType}</sum:TipoFactura>`,
    `      <sum:CuotaTotal>${input.taxAmount.toFixed(2)}</sum:CuotaTotal>`,
    `      <sum:ImporteTotal>${input.total.toFixed(2)}</sum:ImporteTotal>`,
    "      <sum:Encadenamiento>",
    input.previousHash
      ? `        <sum:RegistroAnterior><sum:Huella>${input.previousHash}</sum:Huella></sum:RegistroAnterior>`
      : "        <sum:PrimerRegistro>S</sum:PrimerRegistro>",
    "      </sum:Encadenamiento>",
    `      <sum:Huella>${hash}</sum:Huella>`,
    `      <sum:FechaHoraHusoGenRegistro>${ts}</sum:FechaHoraHusoGenRegistro>`,
    "    </sum:RegistroAlta>",
    "  </sum:RegistroFactura>",
    "</sum:RegFactuSistemaFacturacion>",
  ].join("\n");
}

function mockCsv(hash: string): string {
  return hash.slice(0, 16).toUpperCase();
}

/**
 * Sends an invoice record to Verifactu. Returns the chain hash, IDFACT,
 * AEAT CSV and structured response. Dispatches by `VERIFACTU_ENV`:
 *  - `mock`  → no network call (used for MVP and CI)
 *  - `test`  → AEAT pre-production WSDL (stub, throws until wired)
 *  - `prod`  → AEAT production WSDL (stub, throws until wired)
 */
export async function submitToVerifactu(
  input: VerifactuSubmitInput,
): Promise<VerifactuSubmitResult> {
  const env = serverEnv();
  const hash = computeInvoiceHash(input);
  const idfact = buildIdfact(input.nif, input.invoiceNumber, input.issueDate);
  const xml = buildVerifactuXml(input, hash);

  log.info(
    { mode: env.VERIFACTU_ENV, invoice: input.invoiceNumber, hash, idfact, xmlBytes: xml.length },
    "verifactu_submit_start",
  );

  if (env.VERIFACTU_ENV === "mock") {
    const csv = mockCsv(hash);
    log.info({ invoice: input.invoiceNumber, csv }, "verifactu_submit_mock_ok");
    return {
      status: "accepted",
      csv,
      hash,
      idfact,
      response: { mock: true, csv, acceptedAt: new Date().toISOString() },
      errorMessage: null,
    };
  }

  if (env.VERIFACTU_ENV === "test" || env.VERIFACTU_ENV === "prod") {
    // Real SOAP submit requires XAdES-EPES signature with the p12 cert.
    // Deferred: wire `soap` + `node-forge` here when credentials are provisioned.
    log.warn({ mode: env.VERIFACTU_ENV }, "verifactu_submit_not_implemented");
    return {
      status: "error",
      csv: null,
      hash,
      idfact,
      response: { error: "VERIFACTU_ENV not wired" },
      errorMessage: "Modo Verifactu real no implementado en este MVP",
    };
  }

  return {
    status: "error",
    csv: null,
    hash,
    idfact,
    response: { error: "unknown VERIFACTU_ENV" },
    errorMessage: "VERIFACTU_ENV desconocido",
  };
}
