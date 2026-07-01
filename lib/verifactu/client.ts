import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import { AEAT_SOAP_ACTION_ALTA, AEAT_SOAP_ENDPOINT } from "@/lib/verifactu/constants";
import { computeInvoiceHash, spanishTimestamp } from "@/lib/verifactu/hash";
import { buildIdfact } from "@/lib/verifactu/idfact";
import { loadP12Cert } from "@/lib/verifactu/sign";
import { XMLParser } from "fast-xml-parser";

const log = scopedLogger("verifactu");

export type VatLine = { rate: number; base: number; tax: number };

/** Subset of env vars accessed by buildVerifactuXml — easier to mock in tests. */
export type SistemaInformaticoEnv = {
  VERIFACTU_SOFTWARE_NAME: string;
  VERIFACTU_SOFTWARE_ID: string;
  VERIFACTU_SOFTWARE_VERSION: string;
  VERIFACTU_INSTALLATION_NUMBER: string;
};

export type VerifactuSubmitInput = {
  nif: string;
  invoiceNumber: string;
  invoiceType: string;
  issueDate: Date;
  taxAmount: number;
  total: number;
  previousHash: string | null;
  generatedAt: Date;
  emisorName: string;
  clientNif: string | null;
  clientName: string | null;
  descriptionOperacion: string;
  vatLines: VatLine[];
  /** Required for Encadenamiento.RegistroAnterior (non-first invoices). */
  previousInvoiceNumber: string | null;
  previousIssueDate: Date | null;
};

export type VerifactuSubmitResult = {
  status: "accepted" | "rejected" | "error";
  csv: string | null;
  hash: string;
  idfact: string;
  response: Record<string, unknown>;
  errorMessage: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ddmmyyyy(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

/**
 * Build the VERI*FACTU XML payload per Anexo I/II, HAC/1177/2024.
 *
 * All mandatory XSD elements are included: IDVersion, ObligadoEmision/NombreRazon,
 * NombreRazonEmisor, Destinatarios (F1), DescripcionOperacion, Desglose (per-rate),
 * SistemaInformatico, TipoHuella.
 *
 * No XAdES signature — VERI*FACTU uses mTLS + hash chain for integrity.
 * XAdES is only required in offline (non-verifactu) mode.
 */
export function buildVerifactuXml(
  input: VerifactuSubmitInput,
  hash: string,
  env: SistemaInformaticoEnv,
): string {
  const SUM =
    "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";

  // Encadenamiento: first invoice → PrimerRegistro; subsequent → full previous ID
  const encadenamiento =
    input.previousHash && input.previousInvoiceNumber && input.previousIssueDate
      ? [
          "      <sum:Encadenamiento>",
          "        <sum:RegistroAnterior>",
          `          <sum:IDEmisorFacturaAnterior>${esc(input.nif)}</sum:IDEmisorFacturaAnterior>`,
          `          <sum:NumSerieFacturaAnterior>${esc(input.previousInvoiceNumber)}</sum:NumSerieFacturaAnterior>`,
          `          <sum:FechaExpedicionFacturaAnterior>${ddmmyyyy(input.previousIssueDate)}</sum:FechaExpedicionFacturaAnterior>`,
          `          <sum:Huella>${esc(input.previousHash)}</sum:Huella>`,
          "        </sum:RegistroAnterior>",
          "      </sum:Encadenamiento>",
        ].join("\n")
      : "      <sum:Encadenamiento><sum:PrimerRegistro>S</sum:PrimerRegistro></sum:Encadenamiento>";

  // Destinatarios: required for F1 (full invoice) when client NIF is known
  const destinatarios =
    input.invoiceType === "F1" && input.clientNif
      ? [
          "      <sum:Destinatarios>",
          "        <sum:IDDestinatario>",
          `          <sum:NombreRazon>${esc(input.clientName ?? "")}</sum:NombreRazon>`,
          `          <sum:NIF>${esc(input.clientNif)}</sum:NIF>`,
          "        </sum:IDDestinatario>",
          "      </sum:Destinatarios>",
        ].join("\n")
      : null;

  // Desglose: one DetalleDesglose per distinct VAT rate
  const desgloseLines = input.vatLines
    .map((l) =>
      [
        "        <sum:DetalleDesglose>",
        "          <sum:ClaveRegimen>01</sum:ClaveRegimen>",
        "          <sum:CalificacionOperacion>S1</sum:CalificacionOperacion>",
        `          <sum:TipoImpositivo>${l.rate.toFixed(2)}</sum:TipoImpositivo>`,
        `          <sum:BaseImponibleOImporteNoSujeto>${l.base.toFixed(2)}</sum:BaseImponibleOImporteNoSujeto>`,
        `          <sum:CuotaRepercutida>${l.tax.toFixed(2)}</sum:CuotaRepercutida>`,
        "        </sum:DetalleDesglose>",
      ].join("\n"),
    )
    .join("\n");

  return [
    `<sum:RegFactuSistemaFacturacion xmlns:sum="${SUM}">`,
    "  <sum:Cabecera>",
    "    <sum:ObligadoEmision>",
    `      <sum:NombreRazon>${esc(input.emisorName)}</sum:NombreRazon>`,
    `      <sum:NIF>${esc(input.nif)}</sum:NIF>`,
    "    </sum:ObligadoEmision>",
    "  </sum:Cabecera>",
    "  <sum:RegistroFactura>",
    "    <sum:RegistroAlta>",
    "      <sum:IDVersion>1.0</sum:IDVersion>",
    "      <sum:IDFactura>",
    `        <sum:IDEmisorFactura>${esc(input.nif)}</sum:IDEmisorFactura>`,
    `        <sum:NumSerieFactura>${esc(input.invoiceNumber)}</sum:NumSerieFactura>`,
    `        <sum:FechaExpedicionFactura>${ddmmyyyy(input.issueDate)}</sum:FechaExpedicionFactura>`,
    "      </sum:IDFactura>",
    `      <sum:NombreRazonEmisor>${esc(input.emisorName)}</sum:NombreRazonEmisor>`,
    `      <sum:TipoFactura>${esc(input.invoiceType)}</sum:TipoFactura>`,
    `      <sum:DescripcionOperacion>${esc(input.descriptionOperacion.slice(0, 250))}</sum:DescripcionOperacion>`,
    destinatarios,
    "      <sum:Desglose>",
    desgloseLines,
    "      </sum:Desglose>",
    `      <sum:CuotaTotal>${input.taxAmount.toFixed(2)}</sum:CuotaTotal>`,
    `      <sum:ImporteTotal>${input.total.toFixed(2)}</sum:ImporteTotal>`,
    encadenamiento,
    "      <sum:SistemaInformatico>",
    `        <sum:NombreRazon>${esc(input.emisorName)}</sum:NombreRazon>`,
    `        <sum:NIF>${esc(input.nif)}</sum:NIF>`,
    `        <sum:NombreSistemaInformatico>${esc(env.VERIFACTU_SOFTWARE_NAME)}</sum:NombreSistemaInformatico>`,
    `        <sum:IdSistemaInformatico>${esc(env.VERIFACTU_SOFTWARE_ID)}</sum:IdSistemaInformatico>`,
    `        <sum:Version>${esc(env.VERIFACTU_SOFTWARE_VERSION)}</sum:Version>`,
    `        <sum:NumeroInstalacion>${esc(env.VERIFACTU_INSTALLATION_NUMBER)}</sum:NumeroInstalacion>`,
    "        <sum:TipoUsoPosibleSoloVerifactu>S</sum:TipoUsoPosibleSoloVerifactu>",
    "        <sum:TipoUsoPosibleMultiOT>N</sum:TipoUsoPosibleMultiOT>",
    "        <sum:IndicadorMultiples>N</sum:IndicadorMultiples>",
    "      </sum:SistemaInformatico>",
    `      <sum:FechaHoraHusoGenRegistro>${spanishTimestamp(input.generatedAt)}</sum:FechaHoraHusoGenRegistro>`,
    "      <sum:TipoHuella>01</sum:TipoHuella>",
    `      <sum:Huella>${esc(hash)}</sum:Huella>`,
    "    </sum:RegistroAlta>",
    "  </sum:RegistroFactura>",
    "</sum:RegFactuSistemaFacturacion>",
  ]
    .filter((l) => l !== null)
    .join("\n");
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
