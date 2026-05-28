import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { z } from "zod";

const log = scopedLogger("deck.track");

const Body = z.object({
  sessionId: z.string().min(8).max(64),
  slideKey: z.string().min(1).max(64),
  slideIndex: z.number().int().min(0).max(99),
  totalSlides: z.number().int().min(1).max(99),
  dwellMs: z.number().int().min(0).max(1_800_000),
  isFinal: z.boolean(),
});

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();

  const { data: proposal } = await admin
    .from("proposals")
    .select("id, number, title, status, created_by, clients(name)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!proposal || proposal.status === "draft") {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;

  const insert = await admin.from("proposal_view_events").insert({
    proposal_id: proposal.id as string,
    session_id: parsed.data.sessionId,
    slide_key: parsed.data.slideKey,
    slide_index: parsed.data.slideIndex,
    total_slides: parsed.data.totalSlides,
    dwell_ms: parsed.data.dwellMs,
    is_final: parsed.data.isFinal,
    viewer_type: "client",
    surface: "deck",
    user_agent: userAgent,
  });

  if (insert.error) {
    log.error({ err: insert.error }, "slide_view_insert_failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  // If the client reached the final slide, notify the proposal owner —
  // but only once per session to avoid spam.
  if (parsed.data.isFinal && proposal.created_by) {
    const { data: existing } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_id", proposal.created_by as string)
      .eq("entity_type", "proposal")
      .eq("entity_id", proposal.id as string)
      .eq("event_type", "proposal_deck_completed")
      .like("body", `%${parsed.data.sessionId}%`)
      .maybeSingle();

    if (!existing) {
      const clientName =
        (proposal as unknown as { clients: { name: string } | null }).clients?.name ?? "Cliente";
      await admin.from("notifications").insert({
        recipient_id: proposal.created_by as string,
        actor_id: null,
        event_type: "proposal_deck_completed",
        entity_type: "proposal",
        entity_id: proposal.id as string,
        body: `${clientName} ha visto la presentación completa de ${proposal.number} [${parsed.data.sessionId}]`,
        link: `/proposals/${proposal.id as string}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
