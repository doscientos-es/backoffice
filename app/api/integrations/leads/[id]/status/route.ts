import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { scopedLogger } from "@/lib/logger";
import type { LeadStatusType } from "@/lib/schemas/lead";
import { createAdminClient } from "@/lib/supabase/admin";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("lead-status-callback");

/** Constant-time string comparison to avoid token timing attacks. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Maps the compact actions sent from the Telegram inline keyboard to the
 * canonical lead status. Only triage actions that add value from a chat live
 * here — richer transitions stay in the backoffice UI.
 */
const ACTION_TO_STATUS: Record<string, LeadStatusType> = {
  contacted: "qualifying",
  qualifying: "qualifying",
  quoted: "quoted",
  won: "won",
  lost: "lost",
  not_interested: "not_interested",
};

const CLOSURE_STATUSES: ReadonlySet<LeadStatusType> = new Set(["lost", "not_interested"]);

/** Human-readable Spanish labels for the Telegram confirmation message. */
const STATUS_LABEL: Record<LeadStatusType, string> = {
  new: "Nuevo",
  qualifying: "Contactado",
  quoted: "Presupuestado",
  won: "Ganado",
  lost: "Perdido",
  not_interested: "No interesa",
  archived: "Archivado",
};

/**
 * POST /api/integrations/leads/[id]/status
 *
 * Bidirectional callback target for the n8n Telegram workflow. Lets an admin
 * update a lead's status straight from the Telegram message buttons.
 *
 * Auth: header `X-Webhook-Secret: <N8N_WEBHOOK_SECRET>`
 * Body: { action: "contacted" | "won" | "not_interested" | ... }
 * Returns: { ok, from, to, label, leadName } so n8n can edit the message.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const env = serverEnv();

  if (!env.N8N_WEBHOOK_SECRET) {
    log.warn("N8N_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "callback not configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-webhook-secret") ?? "";
  if (!provided || !safeEqual(provided, env.N8N_WEBHOOK_SECRET)) {
    log.warn({ secretProvided: Boolean(provided) }, "invalid webhook secret");
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { id: leadId } = await ctx.params;

  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const action = (body.action ?? "").trim();
  const nextStatus = ACTION_TO_STATUS[action];
  if (!nextStatus) {
    return NextResponse.json({ ok: false, error: `unknown action: ${action}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Read current state first so we can log `from → to` and skip no-ops.
  const { data: current, error: readError } = await supabase
    .from("leads")
    .select("name, status")
    .eq("id", leadId)
    .is("deleted_at", null)
    .single();

  if (readError || !current) {
    log.warn({ leadId, err: readError }, "lead not found");
    return NextResponse.json({ ok: false, error: "lead not found" }, { status: 404 });
  }

  const fromStatus = current.status as LeadStatusType;
  const leadName = current.name as string;

  if (fromStatus === nextStatus) {
    return NextResponse.json({
      ok: true,
      unchanged: true,
      from: fromStatus,
      to: nextStatus,
      label: STATUS_LABEL[nextStatus],
      leadName,
    });
  }

  const isClosure = CLOSURE_STATUSES.has(nextStatus);
  const updates: Record<string, unknown> = {
    status: nextStatus,
    lost_reason: isClosure ? "Marcado desde Telegram" : null,
    lost_at: isClosure ? new Date().toISOString() : null,
  };

  const { error: updateError } = await supabase.from("leads").update(updates).eq("id", leadId);
  if (updateError) {
    log.error({ leadId, err: updateError }, "failed to update lead status");
    return NextResponse.json({ ok: false, error: "update failed" }, { status: 500 });
  }

  // Log the transition in the interactions timeline (system action → no user).
  await supabase.from("lead_interactions").insert({
    lead_id: leadId,
    type: "status_change",
    subject: `Estado: ${fromStatus} → ${nextStatus}`,
    body: "Vía Telegram",
    payload: { from: fromStatus, to: nextStatus, source: "telegram" },
  });

  log.info({ leadId, from: fromStatus, to: nextStatus }, "lead status updated via Telegram");

  return NextResponse.json({
    ok: true,
    from: fromStatus,
    to: nextStatus,
    label: STATUS_LABEL[nextStatus],
    leadName,
  });
}
