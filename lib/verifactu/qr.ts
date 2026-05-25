import { serverEnv } from "@/lib/env";
import QRCode from "qrcode";

/**
 * Build the QR payload URL pointing to the AEAT cotejo endpoint (or the mock).
 * In `mock` mode, points to a local route that mirrors the same query params.
 */
export type QrParams = {
  nif: string;
  invoiceNumber: string;
  issueDate: Date;
  total: number;
};

const AEAT_PROD = "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR";
const AEAT_TEST = "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR";

export function buildQrUrl(p: QrParams, appUrl: string): string {
  const env = serverEnv();
  const dd = String(p.issueDate.getUTCDate()).padStart(2, "0");
  const mm = String(p.issueDate.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = String(p.issueDate.getUTCFullYear());
  const qs = new URLSearchParams({
    nif: p.nif,
    numserie: p.invoiceNumber,
    fecha: `${dd}-${mm}-${yyyy}`,
    importe: p.total.toFixed(2),
  });
  if (env.VERIFACTU_ENV === "prod") return `${AEAT_PROD}?${qs.toString()}`;
  if (env.VERIFACTU_ENV === "test") return `${AEAT_TEST}?${qs.toString()}`;
  return `${appUrl}/p/verify?${qs.toString()}`;
}

export async function buildQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}
