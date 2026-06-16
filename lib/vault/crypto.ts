import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { serverEnv } from "@/lib/env";

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

function getEncryptionKey(): Buffer {
  const raw = process.env.VAULT_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("VAULT_ENCRYPTION_KEY must be 32 bytes (base64)");
    return buf;
  }
  // Fallback: derive from service-role key (dev convenience only).
  const seed = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  return scryptSync(seed, "vault-key-salt-v1", 32) as Buffer;
}

/** Encrypts a plaintext string. Returns `iv:authTag:ciphertext` (hex). */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Decrypts a ciphertext produced by `encryptSecret`. */
export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, authTagHex, encHex] = parts as [string, string, string];
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
