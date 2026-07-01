import { serverEnv } from "@/lib/env";

/**
 * Configuration contract for the Verifactu module.
 *
 * This is the module's public "inputs" surface alongside `VerifactuSubmitInput`.
 * Everything the module needs to run is expressed here as concrete, serialisable
 * data — no env access, no framework coupling.
 *
 * `config.ts` is intentionally the ONLY file inside `lib/verifactu/**` that
 * reads application env (`@/lib/env`). It is the single adapter that binds this
 * app to the module. When the module is extracted to a standalone package,
 * every file moves EXCEPT this one: each consuming project keeps its own
 * `verifactuConfigFromEnv()` that maps its env/secrets to `VerifactuConfig`.
 */
export type VerifactuEnvironment = "mock" | "test" | "prod";

export type VerifactuCertificate = {
  /** PKCS#12 (.p12) client certificate, base64-encoded. */
  p12Base64: string;
  /** Passphrase for the .p12 certificate. */
  password: string;
};

/** `SistemaInformatico` block — assigned when registering the software at AEAT. */
export type VerifactuSoftware = {
  name: string;
  id: string;
  version: string;
  installationNumber: string;
};

export type VerifactuConfig = {
  environment: VerifactuEnvironment;
  certificate: VerifactuCertificate;
  software: VerifactuSoftware;
  /** Base URL of the consuming app — used to build the mock QR verify route. */
  appUrl: string;
};

/** Minimal config subset needed to build the tributary QR URL. */
export type VerifactuQrConfig = Pick<VerifactuConfig, "environment" | "appUrl">;

/**
 * Adapter: builds a `VerifactuConfig` from this app's validated env.
 * The only bridge between the app and the Verifactu module.
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
