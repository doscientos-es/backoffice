/**
 * XAdES-BES enveloped signature for Verifactu (HAC/1177/2024).
 *
 * Uses node-forge to load a PKCS12 certificate and sign the XML payload
 * with RSA-SHA256. The signature is embedded before the root closing tag.
 *
 * NOTE: This implementation computes the document digest on the raw UTF-8
 * bytes of the unsigned document. This is valid because:
 *   (a) We generate the XML deterministically (no declaration, no BOM).
 *   (b) The enveloped-signature transform removes the <ds:Signature> element
 *       before digest verification; since the signature is absent from the
 *       input, the digest covers exactly the canonical document bytes.
 */

import { createHash } from "node:crypto";
import forge from "node-forge";
import { spanishTimestamp } from "@/lib/verifactu/hash";

const DS_NS = "http://www.w3.org/2000/09/xmldsig#";
const XADES_NS = "http://uri.etsi.org/01903/v1.3.2#";
const C14N_ALG = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SHA256_ALG = "http://www.w3.org/2001/04/xmlenc#sha256";

export interface P12Cert {
  certDerBase64: string; // DER cert encoded in base64
  certDigestB64: string; // SHA-256(DER) in base64
  issuerName: string; // X.509 issuer DN (RFC 4514 reversed)
  serialNumber: string; // certificate serial as decimal string
  privateKey: forge.pki.rsa.PrivateKey;
}

/** Load a PKCS12 (.p12) and extract the signing certificate and private key. */
export function loadP12Cert(p12Base64: string, password: string): P12Cert {
  const p12Buf = Buffer.from(p12Base64, "base64");
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buf));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];

  if (!certBags.length) throw new Error("PKCS12: no certificate bag found");
  if (!keyBags.length) throw new Error("PKCS12: no private key bag found");

  const cert = certBags[0].cert!;
  const privateKey = keyBags[0].key as forge.pki.rsa.PrivateKey;

  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certDerBase64 = Buffer.from(certDerBytes, "binary").toString("base64");
  const certDigestB64 = createHash("sha256")
    .update(Buffer.from(certDerBase64, "base64"))
    .digest("base64");

  // RFC 4514: reverse attribute order
  const issuerName = cert.issuer.attributes
    .slice()
    .reverse()
    .map((a: forge.pki.CertificateField) => `${a.shortName}=${escapeRdn(String(a.value))}`)
    .join(",");

  // Serial number as decimal (forge gives hex without 0x prefix)
  const serialNumber = BigInt("0x" + cert.serialNumber).toString(10);

  return { certDerBase64, certDigestB64, issuerName, serialNumber, privateKey };
}

function escapeRdn(v: string): string {
  return v.replace(/[,+="\\<>;#]/g, (c) => "\\" + c);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sha256b64(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("base64");
}
