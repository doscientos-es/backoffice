import { requireUser } from "@/lib/auth";
import {
  backupsCacheTag,
  deleteClientBackup,
  getClientBackups,
  isFileBrowserConfigured,
} from "@/lib/filebrowser";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ client: string }> }) {
  await requireUser();

  const { client } = await params;
  const { searchParams } = new URL(request.url);
  const subPath = searchParams.get("path") ?? "";

  const data = await getClientBackups(client, subPath);

  if (!data) {
    // FileBrowser is an upstream dependency (Tailscale/container). When it is
    // unreachable or rejects auth, this is a 503 (upstream unavailable), not a
    // 500 — our code worked, the dependency is down.
    return NextResponse.json({ error: "FileBrowser no disponible" }, { status: 503 });
  }

  return NextResponse.json(data);
}

/**
 * Permanently deletes a single backup file. Restricted to owner/admin: this is
 * an irreversible operation on the FileBrowser server (no soft-delete/undo).
 *
 * DELETE /api/backups/[client]?path=daily/dump.sql
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ client: string }> },
) {
  const user = await requireUser();
  if (user.role !== "owner" && user.role !== "admin") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  if (!isFileBrowserConfigured()) {
    return NextResponse.json({ error: "FileBrowser no disponible" }, { status: 503 });
  }

  const { client } = await params;
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path") ?? "";

  if (!filePath) {
    return NextResponse.json({ error: "path requerido" }, { status: 400 });
  }

  // Path traversal guard: keep the target strictly inside the client slug.
  // Reject parent-dir hops and absolute paths so a crafted `path` can never
  // escape `{client}/` and delete arbitrary files on the FileBrowser server.
  if (filePath.includes("..") || filePath.startsWith("/")) {
    return NextResponse.json({ error: "Ruta no válida" }, { status: 400 });
  }

  const ok = await deleteClientBackup(client, filePath);
  if (!ok) {
    return NextResponse.json({ error: "No se pudo eliminar el archivo" }, { status: 503 });
  }

  // Drop the cached listings for this client so the next fetch reflects the
  // deletion instead of serving the (now stale) revalidate-window snapshot.
  revalidateTag(backupsCacheTag(client));

  return NextResponse.json({ ok: true });
}
