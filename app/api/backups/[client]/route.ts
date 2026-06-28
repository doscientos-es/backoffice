import { requireUser } from "@/lib/auth";
import { getClientBackups } from "@/lib/filebrowser";
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
