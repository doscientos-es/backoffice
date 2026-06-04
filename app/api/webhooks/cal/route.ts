import { serverEnv } from "@/lib/env";
import {
  type CalWebhookPayload,
  mapCalToLeadIntake,
  verifyCalSignature,
} from "@/lib/integrations/cal";
import { ingestLead } from "@/lib/integrations/lead-intake";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("cal-webhook");

export async function POST(request: NextRequest) {
  const env = serverEnv();

  if (!env.CAL_WEBHOOK_SECRET) {
    log.warn("CAL_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const signature = request.headers.get("x-cal-signature-256");

  if (!verifyCalSignature(env.CAL_WEBHOOK_SECRET, raw, signature)) {
    log.warn("invalid cal signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: CalWebhookPayload;
  try {
    payload = JSON.parse(raw) as CalWebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { triggerEvent } = payload;
  const intake = mapCalToLeadIntake(payload);
  const result = await ingestLead(intake);

  if (!result.ok) {
    log.error({ error: result.error, bookingId: payload.payload.uid }, "ingestLead failed");
    return NextResponse.json({ ok: false, error: result.error, partial: true });
  }

  const supabase = createAdminClient();
  const leadId = result.leadId;

  // Update lead status if it's a booking event
  if (triggerEvent === "BOOKING_CREATED" || triggerEvent === "BOOKING_RESCHEDULED") {
    await supabase
      .from("leads")
      .update({ status: "qualifying", updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("status", "new"); // Only move from new to qualifying
  }

  // Log interaction
  await supabase.from("lead_interactions").insert({
    lead_id: leadId,
    type: "note",
    subject: `Cal.com: ${triggerEvent}`,
    body: `Booking: ${payload.payload.title}\nTime: ${payload.payload.startTime} - ${payload.payload.endTime}\nUID: ${payload.payload.uid}`,
    payload: payload as unknown as Record<string, unknown>,
  });

  return NextResponse.json({
    ok: true,
    leadId,
    duplicate: result.duplicate,
  });
}
