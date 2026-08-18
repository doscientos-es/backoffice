import { isDemoMode } from "@/lib/demo";
import { serverEnv } from "@/lib/env";
import type { VerifactuConfig } from "@doscientos/verifactu";

/** Serializable safe subset persisted with the immutable fiscal record. */
export function verifactuSoftwareSnapshotFromEnv(): VerifactuConfig["software"] {
  return verifactuConfigFromEnv().software;
}

/**
 * App-specific adapter for the Verifactu package.
 *
 * This file is intentionally the ONLY one inside `lib/verifactu/**` that reads
 * application env (`@/lib/env`). It is the single bridge that binds THIS app to
 * the (portable) Verifactu package. The public configuration contract lives in
 * `types.ts`; when the package is extracted, every file moves with it EXCEPT
 * this adapter: each consuming project keeps its own `verifactuConfigFromEnv()`
 * that maps its own env/secrets into a `VerifactuConfig`.
 */

/**
 * Adapter: builds a `VerifactuConfig` from this app's validated env.
 * The only bridge between the app and the Verifactu package.
 */
export function verifactuConfigFromEnv(): VerifactuConfig {
  const env = serverEnv();
  const environment = isDemoMode() ? "mock" : env.VERIFACTU_ENV;
  if (environment === "prod") {
    if (!env.VERIFACTU_PRODUCER_NIF.trim()) {
      throw new Error("VERIFACTU_PRODUCER_NIF es obligatorio en producción");
    }
    if (!env.VERIFACTU_CERT_P12_BASE64 || !env.VERIFACTU_CERT_PASSWORD) {
      throw new Error("El certificado P12 de VERI*FACTU es obligatorio en producción");
    }
    if (!env.VERIFACTU_CERT_EXPIRES_AT) {
      throw new Error("VERIFACTU_CERT_EXPIRES_AT es obligatorio en producción");
    }
    const expiresAt = new Date(env.VERIFACTU_CERT_EXPIRES_AT);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new Error("El certificado P12 de VERI*FACTU está caducado o tiene una fecha inválida");
    }
  }
  return {
    environment,
    certificate: {
      p12Base64: env.VERIFACTU_CERT_P12_BASE64,
      password: env.VERIFACTU_CERT_PASSWORD,
    },
    software: {
      producerName: env.VERIFACTU_PRODUCER_NAME,
      producerNif: env.VERIFACTU_PRODUCER_NIF,
      name: env.VERIFACTU_SOFTWARE_NAME,
      id: env.VERIFACTU_SOFTWARE_ID,
      version: env.VERIFACTU_SOFTWARE_VERSION,
      installationNumber: env.VERIFACTU_INSTALLATION_NUMBER,
      onlyVerifactu: true,
      multipleTaxpayers: false,
    },
    appUrl: env.NEXT_PUBLIC_APP_URL,
  };
}
