// Temporary diagnostic: replays the RegistroAlta of invoice 2026-000007 against
// the AEAT PREPRODUCTION endpoint and dumps the raw SOAP response.
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { buildVerifactuXml } from "../../../modules/verifactu/dist/index.js";

const envPath = path.resolve(process.cwd(), ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const input = {
  nif: "B88873393",
  invoiceNumber: process.env.DIAG_NUM ?? "2026-000007",
  invoiceType: "F1",
  issueDate: new Date("2026-07-30T00:00:00Z"),
  taxAmount: 63,
  total: 363,
  previousHash: "20CE2F74E7373738F80A4EB75E18AD6B279D3FC30EE7A7B3000878A9A738D143",
  generatedAt: new Date(),
  emisorName: "DOSCIENTOS DESARROLLO TECNOLOGICO, S.L.",
  clientNif: "B23990294",
  clientName: "OPTIENERGIA CONSULTING SL",
  descriptionOperacion: "2 PAGO DESARROLLO CRM A MEDIDA",
  vatLines: [{ rate: 21, base: 300, tax: 63 }],
  previousInvoiceNumber: "2026-000005",
  previousIssueDate: new Date("2026-07-05T00:00:00Z"),
};

const software = {
  name: process.env.VERIFACTU_SOFTWARE_NAME,
  id: process.env.VERIFACTU_SOFTWARE_ID,
  version: process.env.VERIFACTU_SOFTWARE_VERSION,
  installationNumber: process.env.VERIFACTU_INSTALLATION_NUMBER,
};

const dd = (d) =>
  `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
const madrid = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
const stamp = `${madrid.format(input.generatedAt).replace(" ", "T")}+02:00`;
const payload = [
  `IDEmisorFactura=${input.nif}`,
  `NumSerieFactura=${input.invoiceNumber}`,
  `FechaExpedicionFactura=${dd(input.issueDate)}`,
  `TipoFactura=${input.invoiceType}`,
  `CuotaTotal=${input.taxAmount.toFixed(2)}`,
  `ImporteTotal=${input.total.toFixed(2)}`,
  `Huella=${input.previousHash ?? ""}`,
  `FechaHoraHusoGenRegistro=${stamp}`,
].join("&");
const hash = crypto
  .createHash("sha256")
  .update(payload, "utf8")
  .digest("hex")
  .toUpperCase();

const xml = buildVerifactuXml(input, hash, software);
const envelope = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Header/><soapenv:Body>${xml}</soapenv:Body></soapenv:Envelope>`;

console.log("──── REQUEST ────");
console.log(xml);

const endpoint = "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP";
const pfx = Buffer.from(process.env.VERIFACTU_CERT_P12_BASE64, "base64");
const body = Buffer.from(envelope, "utf8");
const u = new URL(endpoint);

const req = https.request(
  {
    hostname: u.hostname,
    port: 443,
    path: u.pathname,
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Content-Length": body.length,
      SOAPAction:
        "https://www1.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SistemaFacturacion/altaRegistroFactura",
    },
    pfx,
    passphrase: process.env.VERIFACTU_CERT_PASSWORD,
    rejectUnauthorized: true,
  },
  (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      console.log("──── HTTP", res.statusCode, "────");
      console.log(res.headers["content-type"]);
      console.log(Buffer.concat(chunks).toString("utf8"));
    });
  },
);
req.on("error", (e) => console.error("NETWORK ERROR", e));
req.write(body);
req.end();
