import { SupabaseStorageProvider } from "./supabase";
import type { StorageProvider } from "./types";

export type { StorageBucket, StorageProvider } from "./types";

/**
 * Returns the active StorageProvider.
 * Swap the implementation here (or via STORAGE_PROVIDER env var) when migrating
 * away from Supabase without touching any call site.
 */
export function getStorage(): StorageProvider {
  // Future: if (process.env.STORAGE_PROVIDER === "s3") return new S3StorageProvider();
  return new SupabaseStorageProvider();
}
