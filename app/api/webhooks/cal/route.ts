import { after, type NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import {
  type CalWebhookPayload,
  mapCalToLeadIntake,
  verifyCalSignature,
} from "@/lib/integrations/cal";
import { ingestLead } from "@/lib/integrations/lead-intake";
import { pushMetaConversion } from "@/lib/integrations/meta-capi";
import { scopedLogger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { data: updated } = await supabase
      .from("leads")
      .update({ status: "in_conversation", updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("status", "new") // Booking a call is an inbound reply: the conversation is alive
      .select("id")
      .maybeSingle();

    // Fire-and-forget: notify Meta CAPI of the funnel stage transition.
    if (updated) {
      after(async () => {
        try {
          const { data: lead } = await createAdminClient()
            .from("leads")
            .select("email, phone")
            .eq("id", leadId)
            .maybeSingle();
          if (lead) {
            await pushMetaConversion({
              eventName: "Lead",
              eventId: `lead-${leadId}-in_conversation`,
              email: lead.email as string | null,
              phone: lead.phone as string | null,
              actionSource: "system_generated",
              custom_data: {
                event_source: "crm",
                lead_event_source: "doscientos-backoffice",
                lead_status: "in_conversation",
              },
            });
          }
        } catch (e) {
          log.warn({ err: e, leadId }, "meta_capi_status_failed");
        }
      });
    }
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
