import { serverEnv } from "@/lib/env";
import type { VerifactuConfig } from "@doscientos/verifactu";

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
  return {
    environment: env.VERIFACTU_ENV,
    certificate: {
      p12Base64: env.VERIFACTU_CERT_P12_BASE64,
      password: env.VERIFACTU_CERT_PASSWORD,
    },
    software: {
      name: env.VERIFACTU_SOFTWARE_NAME,
      id: env.VERIFACTU_SOFTWARE_ID,
      version: env.VERIFACTU_SOFTWARE_VERSION,
      installationNumber: env.VERIFACTU_INSTALLATION_NUMBER,
    },
    appUrl: env.NEXT_PUBLIC_APP_URL,
  };
}
