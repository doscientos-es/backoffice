import type { VerifactuConfig } from '@doscientos/verifactu'

import { isDemoMode } from '@/lib/demo'
import { serverEnv } from '@/lib/env'

/** Serializable safe subset persisted with the immutable fiscal record. */
export function verifactuSoftwareSnapshotFromEnv(): VerifactuConfig['software'] {
  return verifactuInvoiceConfigFromEnv().software
}

/**
 * App-specific adapter for the Verifactu package.
 *
 * This file is intentionally the ONLY one inside `lib/verifactu/**` that reads
 * application env (`@/lib/env`). It is the single bridge that binds THIS app to
 * the (portable) Verifactu package. The public configuration contract lives in
 * `types.ts`; when the package is extracted, every file moves with it EXCEPT
 * this adapter: each consuming project keeps its own configuration adapter
 * that maps its own env/secrets into a `VerifactuConfig`.
 */

/**
 * Validates the configuration shared by the AEAT test and production flows.
 */
function assertOperationalVerifactuConfiguration(): void {
  const env = serverEnv()
  if (!env.VERIFACTU_PRODUCER_NIF.trim()) {
    throw new Error('VERIFACTU_PRODUCER_NIF es obligatorio para operar con VERI*FACTU')
  }
  if (!env.VERIFACTU_CERT_P12_BASE64 || !env.VERIFACTU_CERT_PASSWORD) {
    throw new Error('El certificado P12 de VERI*FACTU es obligatorio para conectar con AEAT')
  }
  if (!env.VERIFACTU_CERT_EXPIRES_AT) {
    throw new Error('VERIFACTU_CERT_EXPIRES_AT es obligatorio para conectar con AEAT')
  }
  const expiresAt = new Date(env.VERIFACTU_CERT_EXPIRES_AT)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('El certificado P12 de VERI*FACTU está caducado o tiene una fecha inválida')
  }
}

function verifactuConfigFromEnv(environment: 'test' | 'prod'): VerifactuConfig {
  const env = serverEnv()
  const resolvedEnvironment = isDemoMode() ? 'mock' : environment
  if (resolvedEnvironment !== 'mock') assertOperationalVerifactuConfiguration()
  return {
    environment: resolvedEnvironment,
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
  }
}

/** Configuration for real invoice issuance, cancellation and fiscal QR generation. */
export function verifactuInvoiceConfigFromEnv(): VerifactuConfig {
  return verifactuConfigFromEnv('prod')
}

/** Configuration for the synthetic record submitted to AEAT pre-production. */
export function verifactuDiagnosticConfigFromEnv(): VerifactuConfig {
  return verifactuConfigFromEnv('test')
}
