import "server-only";

import { serverEnv } from "@/lib/env";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for vault secrets.
 *
 * The key is derived from VAULT_ENCRYPTION_KEY env var (32-byte base64).
 * If not set, we derive one from SUPABASE_SERVICE_ROLE_KEY via scrypt so the
 * app works out of the box in development; in production, set a dedicated key.
 *
 * Ciphertext format (all hex, colon-separated): `iv:authTag:ciphertext`
 */

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 16;

function legacyEncryptionKey(serviceRoleKey: string): Buffer {
  return scryptSync(serviceRoleKey, "vault-key-salt-v1", 32) as Buffer;
}

/**
 * Returns the write key followed by any key used by earlier vault versions.
 *
 * Vault records created before VAULT_ENCRYPTION_KEY existed used the derived
 * service-role key. Keep it only as a read fallback so those records remain
 * recoverable; all newly written data uses the dedicated key.
 */
function getDecryptionKeys(): Buffer[] {
  const env = serverEnv();
  const raw = env.VAULT_ENCRYPTION_KEY;
  if (raw) {
    // Validated as exactly 32 decoded bytes by VaultEncryptionKeySchema.
    return [Buffer.from(raw, "base64"), legacyEncryptionKey(env.SUPABASE_SERVICE_ROLE_KEY)];
  }
  // In production, a dedicated key is mandatory — deriving from the service-role key
  // would mean a single secret leak compromises both DB access and vault encryption.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VAULT_ENCRYPTION_KEY is required in production. " +
      "Generate one with: openssl rand -base64 32",
    );
  }
  // Dev/test convenience fallback only.
  return [legacyEncryptionKey(env.SUPABASE_SERVICE_ROLE_KEY)];
}

function decryptWithKey(ciphertext: Buffer, iv: Buffer, authTag: Buffer, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Encrypts a plaintext string. Returns `iv:authTag:ciphertext` (hex). */
export function encryptSecret(plaintext: string): string {
  const [key] = getDecryptionKeys();
  if (!key) throw new Error("No encryption key available");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Decrypts a ciphertext produced by `encryptSecret`. */
export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, authTagHex, encHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");

  for (const key of getDecryptionKeys()) {
    try {
      return decryptWithKey(encrypted, iv, authTag, key);
    } catch {
      // Try the legacy key when the ciphertext predates VAULT_ENCRYPTION_KEY.
    }
  }

  throw new Error(
    "No se pudo descifrar el secreto: puede estar dañado o haberse cifrado con una clave no disponible.",
  );
}
