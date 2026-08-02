import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { DiagnosticReportEmail } from "@/components/email/diagnostic-report-email";
import { renderDiagnosticPdf } from "@/lib/diagnostics/report";
import { serverEnv, publicEnv } from "@/lib/env";
import { recordConversionEvent } from "@/lib/integrations/conversion-events";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  leadId: z.string().uuid().optional().nullable(),
  email: z.string().email(),
  company: z.string().trim().max(160).optional().nullable(),
  name: z.string().trim().max(160).optional().nullable(),
  answers: z.record(z.unknown()).default({}),
  metrics: z.object({ yearlyHours: z.number().nonnegative(), yearlyCost: z.number().nonnegative(), monthlyHours: z.number().nonnegative(), risk: z.string().max(40), primaryOpportunity: z.string().max(500) }),
  attribution: z.record(z.unknown()).optional().default({}),
});

function allowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const origins = serverEnv().LANDING_ALLOWED_ORIGINS.split(",").map((v) => v.trim().replace(/\/$/, "").toLowerCase());
  return origins.includes("*") || origins.includes(origin.replace(/\/$/, "").toLowerCase());
}

function cors(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin && allowed(request) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

export function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: { ...cors(request), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } }); }

export async function POST(request: NextRequest) {
  if (!allowed(request)) return NextResponse.json({ error: "forbidden_origin" }, { status: 403, headers: cors(request) });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`public-diagnostic:${ip}`, 5).success) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: cors(request) });
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "validation_error", issues: parsed.error.flatten() }, { status: 400, headers: cors(request) });

  const input = parsed.data;
  const supabase = createAdminClient();
  let leadId: string | null = null;
  if (input.leadId) {
    const { data: linkedLead } = await supabase.from("leads").select("id").eq("id", input.leadId).ilike("email", input.email).is("deleted_at", null).maybeSingle();
    leadId = (linkedLead?.id as string | undefined) ?? null;
  }
  if (!leadId) {
    const { data: lead } = await supabase.from("leads").select("id, name, company").ilike("email", input.email).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    leadId = (lead?.id as string | undefined) ?? null;
  }
  const accessToken = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
  const { data: diagnostic, error } = await supabase.from("diagnostics").insert({ lead_id: leadId, email: input.email.toLowerCase(), company: input.company ?? null, answers: input.answers, metrics: input.metrics, access_token: accessToken }).select("id").single();
  if (error || !diagnostic) return NextResponse.json({ error: "diagnostic_failed" }, { status: 502, headers: cors(request) });

  if (leadId) {
    await supabase.from("leads").update({ latest_diagnostic_id: diagnostic.id, diagnostic_completed_at: new Date().toISOString(), calculator_cost: String(Math.round(input.metrics.yearlyCost)), calculator_hours: String(Math.round(input.metrics.yearlyHours)), conversion_step: "diagnostic_completed" }).eq("id", leadId);
  }
  await recordConversionEvent({ event_id: typeof input.attribution.event_id === "string" ? input.attribution.event_id : null, visitor_id: typeof input.attribution.visitor_id === "string" ? input.attribution.visitor_id : null, lead_id: leadId, event_name: "diagnostic_completed", conversion_step: "diagnostic_completed", landing_path: "/diagnostico", payload: { diagnostic_id: diagnostic.id, email: input.email, answers: input.answers, metrics: input.metrics } }, { ip, userAgent: request.headers.get("user-agent") });

  const reportUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/api/public/diagnostics/${diagnostic.id}/pdf?token=${encodeURIComponent(accessToken)}`;
  try {
    const pdf = await renderDiagnosticPdf({ name: input.name ?? input.email, company: input.company ?? null, answers: input.answers, metrics: input.metrics });
    const html = await renderEmail(DiagnosticReportEmail({ name: input.name ?? "", company: input.company, reportUrl, yearlyHours: input.metrics.yearlyHours, yearlyCost: input.metrics.yearlyCost }));
    await sendEmail({ fromName: "doscientos", fromAlias: "hola", to: input.email, subject: `Tu diagnóstico personalizado${input.company ? ` · ${input.company}` : ""}`, html, attachments: [{ filename: "diagnostico-doscientos.pdf", content: pdf }], tags: { diagnostic_id: diagnostic.id, ...(leadId ? { lead_id: leadId } : {}) } });
    await supabase.from("diagnostics").update({ report_sent_at: new Date().toISOString(), status: "sent" }).eq("id", diagnostic.id);
    await recordConversionEvent({ event_name: "diagnostic_report_sent", conversion_step: "diagnostic_report_sent", lead_id: leadId, landing_path: "/diagnostico", payload: { diagnostic_id: diagnostic.id } }, { ip, userAgent: request.headers.get("user-agent") });
  } catch (sendError) {
    console.error("diagnostic_report_send_failed", sendError);
  }

  return NextResponse.json({ ok: true, diagnosticId: diagnostic.id, leadId, reportUrl }, { status: 201, headers: cors(request) });
}
