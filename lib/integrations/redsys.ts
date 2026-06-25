import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Redsys / Paygold (BBVA) integration helper.
 *
 * Implements the SHA-256 HMAC signature algorithm required by Redsys.
 * @see https://pagosonline.redsys.es/parametros-entrada-salida.html
 */

export type RedsysParams = {
  Ds_Merchant_Amount: string; // Centavos (ej. "100" para 1.00 EUR)
  Ds_Merchant_Order: string; // Alphanumeric, 4-12 chars (ej. "202406250001")
  Ds_Merchant_MerchantCode: string; // FUC
  Ds_Merchant_Terminal: string;
  Ds_Merchant_Currency: string; // 978 para EUR
  Ds_Merchant_TransactionType: string; // "0" para Pago Simple
  Ds_Merchant_MerchantURL: string; // Webhook (Notificación Online)
  Ds_Merchant_UrlOK: string; // Redirect on success
  Ds_Merchant_UrlKO: string; // Redirect on failure
  Ds_Merchant_PayMethods?: string; // "T" (tarjeta), "z" (bizum), etc.
  Ds_Merchant_MerchantData?: string; // Optional metadata returned in webhook
};

const REDSYS_URLS = {
  test: "https://sis-t.redsys.es:25443/sis/realizarPago",
  prod: "https://sis.redsys.es/sis/realizarPago",
};

export function getRedsysUrl(): string {
  const env = serverEnv();
  return REDSYS_URLS[env.REDSYS_ENVIRONMENT];
}

/**
 * Generates the parameters and signature for a Redsys form.
 */
export function createRedsysPayment(params: RedsysParams) {
  const env = serverEnv();
  const secret = env.REDSYS_SECRET_KEY;

  const merchantParameters = Buffer.from(JSON.stringify(params)).toString("base64");

  // Redsys SHA-256 Signature derivation:
  // 1. Decode base64 secret key
  const decodedKey = Buffer.from(secret, "base64");

  // 2. Derive key using the Order ID
  const derivedKey = createHmac("sha256", decodedKey).update(params.Ds_Merchant_Order).digest();

  // 3. Compute signature over MerchantParameters using derived key
  const signature = createHmac("sha256", derivedKey).update(merchantParameters).digest("base64");

  return {
    Ds_SignatureVersion: "HMAC_SHA256_V1",
    Ds_MerchantParameters: merchantParameters,
    Ds_Signature: signature,
  };
}

/**
 * Validates a Redsys notification signature.
 */
export function verifyRedsysSignature(merchantParameters: string, signature: string): boolean {
  const env = serverEnv();
  const secret = env.REDSYS_SECRET_KEY;

  // 1. Extract Order from parameters
  const params = JSON.parse(Buffer.from(merchantParameters, "base64").toString("utf-8"));
  const order = params.Ds_Order || params.Ds_Merchant_Order;

  if (!order) return false;

  // 2. Decode secret key
  const decodedKey = Buffer.from(secret, "base64");

  // 3. Derive key
  const derivedKey = createHmac("sha256", decodedKey).update(order).digest();

  // 4. Compute expected signature
  const expectedSignature = createHmac("sha256", derivedKey)
    .update(merchantParameters)
    .digest("base64")
    // Redsys uses URL-safe base64 for signatures in some cases, but for form/notif usually standard.
    // However, Redsys documentation mentions standard Base64.
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Redsys might send standard or url-safe base64. Let's compare both or normalize.
  const normalizedSignature = signature.replace(/\+/g, "-").replace(/\//g, "_");

  return expectedSignature === normalizedSignature;
}

export function parseRedsysResponse(merchantParameters: string) {
  const raw = Buffer.from(merchantParameters, "base64").toString("utf-8");
  return JSON.parse(raw);
}

/**
 * DS_Response 0000 a 0099 indicate success.
 */
export function isRedsysSuccess(responseCode: string | number): boolean {
  const code = Number(responseCode);
  return code >= 0 && code <= 99;
}
