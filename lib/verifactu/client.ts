import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { AEAT_SOAP_ACTION_ALTA, AEAT_SOAP_ENDPOINT } from "@/lib/verifactu/constants";
import { computeInvoiceHash, spanishTimestamp } from "@/lib/verifactu/hash";
import { buildIdfact } from "@/lib/verifactu/idfact";
import { loadP12Cert, signXml } from "@/lib/verifactu/sign";
import { XMLParser } from "fast-xml-parser";

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

/** Format a Date as DD-MM-YYYY (AEAT field format). */
function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Build the SIF/Verifactu XML payload (Anexo I/II, HAC/1177/2024).
 *
 * Dates follow the AEAT XSD type patterns:
 *   FechaExpedicionFactura → DD-MM-YYYY
 *   FechaHoraHusoGenRegistro → DD-MM-YYYYTHH:MM:SS+HH:MM
 */
export function buildVerifactuXml(input: VerifactuSubmitInput, hash: string): string {
  const SUM =
    "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";
  return [
    `<sum:RegFactuSistemaFacturacion xmlns:sum="${SUM}">`,
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
    `        <sum:FechaExpedicionFactura>${ddmmyyyy(input.issueDate)}</sum:FechaExpedicionFactura>`,
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
    `      <sum:FechaHoraHusoGenRegistro>${spanishTimestamp(input.generatedAt)}</sum:FechaHoraHusoGenRegistro>`,
    "    </sum:RegistroAlta>",
    "  </sum:RegistroFactura>",
    "</sum:RegFactuSistemaFacturacion>",
  ].join("\n");
}

/** Wrap the (signed) registration document in a SOAP 1.1 envelope. */
function buildSoapEnvelope(innerXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${innerXml}</soapenv:Body></soapenv:Envelope>`;
}

/** Parse the AEAT SOAP response and extract CSV + status. */
function parseSoapResponse(body: string): { csv: string | null; status: "accepted" | "rejected" } {
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const obj = parser.parse(body) as Record<string, unknown>;
  // Traverse: Envelope > Body > RespuestaRegFactuSistemaFacturacion
  const envelope = obj.Envelope as Record<string, unknown> | undefined;
  const soapBody = envelope?.Body as Record<string, unknown> | undefined;
  const resp = soapBody?.RespuestaRegFactuSistemaFacturacion as Record<string, unknown> | undefined;

  const estadoEnvio = String(resp?.EstadoEnvio ?? "");
  const csv = resp?.CSV ? String(resp.CSV) : null;
  const status = estadoEnvio.toLowerCase().includes("correcto") ? "accepted" : "rejected";
  return { csv, status };
}

function mockCsv(hash: string): string {
  return hash.slice(0, 16).toUpperCase();
}

/**
 * Sends an invoice record to Verifactu. Dispatches by `VERIFACTU_ENV`:
 *  - `mock`  → no network call (hash + QR only; used for MVP and CI)
 *  - `test`  → AEAT pre-production SOAP endpoint (requires P12 cert)
 *  - `prod`  → AEAT production SOAP endpoint (requires P12 cert)
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

  // ── Mock mode ────────────────────────────────────────────────────────────
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

  // ── Real SOAP submission (test / prod) ────────────────────────────────────
  if (env.VERIFACTU_ENV === "test" || env.VERIFACTU_ENV === "prod") {
    if (!env.VERIFACTU_CERT_P12_BASE64 || !env.VERIFACTU_CERT_PASSWORD) {
      log.error({ mode: env.VERIFACTU_ENV }, "verifactu_cert_missing");
      return {
        status: "error",
        csv: null,
        hash,
        idfact,
        response: { error: "certificate not configured" },
        errorMessage:
          "Certificado P12 no configurado (VERIFACTU_CERT_P12_BASE64 / VERIFACTU_CERT_PASSWORD)",
      };
    }

    let cert: ReturnType<typeof loadP12Cert>;
    try {
      cert = loadP12Cert(env.VERIFACTU_CERT_P12_BASE64, env.VERIFACTU_CERT_PASSWORD);
    } catch (err) {
      log.error({ err }, "verifactu_cert_load_error");
      return {
        status: "error",
        csv: null,
        hash,
        idfact,
        response: { error: String(err) },
        errorMessage: `Error cargando certificado: ${String(err)}`,
      };
    }

    const signedXml = signXml(xml, cert, input.generatedAt);
    const soapBody = buildSoapEnvelope(signedXml);
    const endpoint = AEAT_SOAP_ENDPOINT[env.VERIFACTU_ENV];

    let rawResponse: string;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: AEAT_SOAP_ACTION_ALTA,
        },
        body: soapBody,
      });
      rawResponse = await res.text();
      if (!res.ok) {
        log.warn({ status: res.status, endpoint }, "verifactu_http_error");
        return {
          status: "error",
          csv: null,
          hash,
          idfact,
          response: { httpStatus: res.status, body: rawResponse },
          errorMessage: `AEAT HTTP ${res.status}`,
        };
      }
    } catch (err) {
      log.error({ err, endpoint }, "verifactu_network_error");
      return {
        status: "error",
        csv: null,
        hash,
        idfact,
        response: { error: String(err) },
        errorMessage: `Error de red: ${String(err)}`,
      };
    }

    const { csv, status } = parseSoapResponse(rawResponse);
    log.info({ invoice: input.invoiceNumber, csv, status }, "verifactu_submit_ok");
    return {
      status,
      csv,
      hash,
      idfact,
      response: { rawResponse },
      errorMessage: status === "rejected" ? "AEAT rechazó el registro" : null,
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
