/**
 * Proxy download endpoint for FileBrowser files.
 * Streams the raw file through Next.js so credentials stay server-side.
 *
 * GET /api/backups/[client]/download?path=daily/dump.sql
 */
import { requireUser } from "@/lib/auth";
import { isFileBrowserConfigured } from "@/lib/filebrowser";
import { NextResponse } from "next/server";

async function getAuthToken(): Promise<string> {
  const res = await fetch(`${process.env.FILEBROWSER_API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.FILEBROWSER_USER,
      password: process.env.FILEBROWSER_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error("Auth failed");
  return res.text();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ client: string }> },
) {
  await requireUser();

  if (!isFileBrowserConfigured()) {
    return NextResponse.json({ error: "FileBrowser no configurado" }, { status: 503 });
  }

  const { client } = await params;
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("path") ?? "";

  if (!filePath) {
    return NextResponse.json({ error: "path requerido" }, { status: 400 });
  }

  try {
    const token = await getAuthToken();
    const rawUrl = `${process.env.FILEBROWSER_API_URL}/raw/${encodeURIComponent(client)}/${filePath}?auth=${token}`;

    const upstream = await fetch(rawUrl);
    if (!upstream.ok) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: upstream.status });
    }

    const filename = filePath.split("/").pop() ?? "backup";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error descargando el archivo" }, { status: 500 });
  }
}
