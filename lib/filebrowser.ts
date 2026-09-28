/**
 * FileBrowser server utility
 *
 * Authenticates against the internal FileBrowser instance and exposes helpers
 * to list / create backup directories and files for a given client slug.
 *
 * All calls happen server-side — credentials never reach the browser.
 */

import { scopedLogger } from "@/lib/logger";

const log = scopedLogger("filebrowser");

// Module-level token cache. Resets on cold start or explicit invalidation.
let cachedToken: string | null = null;

function apiUrl(): string {
  // Strip trailing slashes so `${apiUrl()}/login` never produces a double slash.
  return (process.env.FILEBROWSER_API_URL ?? "").replace(/\/+$/, "");
}

export function isFileBrowserConfigured(): boolean {
  return Boolean(
    process.env.FILEBROWSER_API_URL?.trim() &&
      process.env.FILEBROWSER_USER?.trim() &&
      process.env.FILEBROWSER_PASSWORD?.trim(),
  );
}

/** Headers required to bypass the localtunnel reminder page. */
const TUNNEL_HEADERS = { "Bypass-Tunnel-Reminder": "true" };

/**
 * Next.js Data Cache tag for a client's backup listings. Tagging every
 * `getClientBackups` fetch lets mutating actions (delete, force backup)
 * invalidate every cached sub-folder listing for that client in one call.
 */
export function backupsCacheTag(clientSlug: string): string {
  return `backups:${clientSlug}`;
}

async function getAuthToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  const res = await fetch(`${apiUrl()}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...TUNNEL_HEADERS },
    body: JSON.stringify({
      username: process.env.FILEBROWSER_USER,
      password: process.env.FILEBROWSER_PASSWORD,
    }),
  });

  if (!res.ok) {
    log.error({ status: res.status }, "filebrowser_auth_failed");
    throw new Error("Error de autenticación en FileBrowser");
  }

  // FileBrowser returns the JWT as plain text in the body.
  const token = await res.text();
  cachedToken = token;
  return token;
}

export type FileBrowserItem = {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  modified: string;
  type: string;
};

export type FileBrowserListing = {
  name: string;
  path: string;
  isDir: boolean;
  items: FileBrowserItem[];
};

/**
 * Ensures a top-level backup directory exists in FileBrowser for `clientSlug`.
 *
 * Uses `POST /api/resources/{slug}/` (trailing slash = directory, `override=false`).
 * - 200 → created.
 * - 409 → already exists; treated as success (idempotent).
 * - Any other error → logged and returns `false` (non-fatal; backups still work,
 *   the folder will be created on first script run).
 *
 * Returns `true` when the directory is ready, `false` on any failure.
 */
export async function ensureClientBackupDir(clientSlug: string): Promise<boolean> {
  if (!isFileBrowserConfigured()) return false;

  try {
    const token = await getAuthToken();
    const url = `${apiUrl()}/resources/${encodeURIComponent(clientSlug)}/?override=false`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "X-Auth": token, ...TUNNEL_HEADERS },
      cache: "no-store",
    });

    if (res.ok || res.status === 409) {
      // 200 = created, 409 = already exists — both are fine.
      log.info({ clientSlug }, "filebrowser_dir_ready");
      return true;
    }

    if (res.status === 401) {
      cachedToken = null;
      log.warn({ clientSlug }, "filebrowser_token_expired_on_mkdir");
    } else {
      log.warn({ clientSlug, status: res.status }, "filebrowser_mkdir_failed");
    }
    return false;
  } catch (err) {
    log.error({ clientSlug, err }, "filebrowser_mkdir_error");
    return false;
  }
}

/**
 * Fetch the directory listing for `clientSlug[/subPath]` from FileBrowser.
 * Returns `null` on any error (missing config, auth failure, 404, etc.).
 */
export async function getClientBackups(
  clientSlug: string,
  subPath = "",
): Promise<FileBrowserListing | null> {
  if (!isFileBrowserConfigured()) return null;

  try {
    const token = await getAuthToken();
    const cleanSub = subPath ? `/${subPath}` : "";
    const url = `${apiUrl()}/resources/${encodeURIComponent(clientSlug)}${cleanSub}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { "X-Auth": token, ...TUNNEL_HEADERS },
      // Backups change a few times a day at most; cache the (slow, tunnelled)
      // upstream listing for 10 min and rely on tag invalidation after a delete
      // or forced backup to keep mutations immediately consistent.
      next: { revalidate: 600, tags: [backupsCacheTag(clientSlug)] },
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Token expired — clear cache so next call re-authenticates.
        cachedToken = null;
        log.warn({ clientSlug }, "filebrowser_token_expired");
      } else {
        log.warn({ clientSlug, status: res.status }, "filebrowser_resources_failed");
      }
      return null;
    }

    return (await res.json()) as FileBrowserListing;
  } catch (err) {
    log.error({ clientSlug, err }, "filebrowser_request_error");
    return null;
  }
}

/**
 * Permanently deletes a single backup file at `clientSlug/filePath` in
 * FileBrowser via `DELETE /api/resources/{slug}/{filePath}`.
 *
 * `filePath` is the path relative to the slug root (e.g. `daily/dump.sql`).
 * The caller MUST validate it against path traversal before reaching here.
 * Returns `true` on success, `false` on any failure (missing config, auth, etc.).
 */
export async function deleteClientBackup(clientSlug: string, filePath: string): Promise<boolean> {
  if (!isFileBrowserConfigured()) return false;

  try {
    const token = await getAuthToken();
    const url = `${apiUrl()}/resources/${encodeURIComponent(clientSlug)}/${filePath}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: { "X-Auth": token, ...TUNNEL_HEADERS },
      cache: "no-store",
    });

    if (res.ok) {
      log.info({ clientSlug, filePath }, "filebrowser_delete_ok");
      return true;
    }

    if (res.status === 401) {
      cachedToken = null;
      log.warn({ clientSlug, filePath }, "filebrowser_token_expired_on_delete");
    } else {
      const body = await res.text().catch(() => "");
      log.warn(
        { clientSlug, filePath, status: res.status, body: body.slice(0, 300) },
        "filebrowser_delete_failed",
      );
    }
    return false;
  } catch (err) {
    log.error({ clientSlug, filePath, err }, "filebrowser_delete_error");
    return false;
  }
}
