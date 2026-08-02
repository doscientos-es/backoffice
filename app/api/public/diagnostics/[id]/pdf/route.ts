import { type NextRequest, NextResponse } from "next/server";
import { renderDiagnosticPdf } from "@/lib/diagnostics/report";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConversionEvent } from "@/lib/integrations/conversion-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse("No autorizado", { status: 401 });
  const supabase = createAdminClient();
  const { data } = await supabase.from("diagnostics").select("id, lead_id, email, company, answers, metrics").eq("id", id).eq("access_token", token).maybeSingle();
  if (!data) return new NextResponse("Informe no encontrado", { status: 404 });
  const pdf = await renderDiagnosticPdf({ name: data.email, company: data.company, answers: data.answers as Record<string, unknown>, metrics: data.metrics as { yearlyHours: number; yearlyCost: number; monthlyHours: number; risk: string; primaryOpportunity: string } });
  await supabase.from("diagnostics").update({ report_opened_at: new Date().toISOString() }).eq("id", id);
  await recordConversionEvent({ event_name: "diagnostic_report_opened", conversion_step: "diagnostic_report_opened", lead_id: data.lead_id as string | null, landing_path: "/diagnostico", payload: { diagnostic_id: id } });
  return new NextResponse(new Uint8Array(pdf), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="diagnostico-doscientos.pdf"`, "Cache-Control": "private, no-store" } });
}
