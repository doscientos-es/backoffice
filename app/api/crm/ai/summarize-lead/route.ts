/**
 * POST /api/crm/ai/summarize-lead
 *
 * Genera un resumen + siguiente paso + temperatura + confianza para un lead.
 * Persiste el resultado en leads.ai_* (sec. 22.1 description.md).
 *
 * Body: { lead_id: string }
 * Auth: requireUser (cualquier miembro del equipo).
 *
 * Devuelve 503 si OPENAI_API_KEY no está configurada — el feature-gate vive
 * en isAIEnabled() para que el frontend pueda detectarlo y mostrar <AiNotice/>.
 */

import { AI_MODELS, isAIEnabled, runAIJson } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("ai.summarize-lead");

const BodySchema = z.object({ lead_id: z.string().uuid() });

const TEMPERATURES = ["hot", "warm", "cold"] as const;
const ResultSchema = z.object({
  summary: z.string().min(1).max(2000),
  suggested_next_step: z.string().min(1).max(500),
  temperature: z.enum(TEMPERATURES),
  confidence: z.number().min(0).max(1),
});
type AIResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = `Eres un asistente de CRM para una agencia de desarrollo web española.
Analiza la información del lead y sus interacciones, y responde SOLO con un JSON con esta forma exacta:
{
  "summary": "resumen en 2-3 frases en español",
  "suggested_next_step": "acción concreta recomendada (1 frase)",
  "temperature": "hot" | "warm" | "cold",
  "confidence": 0.0-1.0
}
No incluyas markdown ni texto fuera del JSON.`;

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "lead_id is required and must be a UUID" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, company, email, phone, source, status, notes")
    .eq("id", body.lead_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (leadErr || !lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  const { data: interactions } = await supabase
    .from("lead_interactions")
    .select("type, subject, body, created_at")
    .eq("lead_id", body.lead_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const interactionsText = (interactions ?? [])
    .reverse()
    .map((i) => {
      const date = new Date(i.created_at as string).toISOString().slice(0, 10);
      const subject = (i.subject as string | null)?.trim();
      const txt = (i.body as string | null)?.trim()?.slice(0, 300);
      return `- ${date} | ${i.type as string}${subject ? ` | "${subject}"` : ""}${txt ? ` | ${txt}` : ""}`;
    })
    .join("\n");

  const userPrompt = `Lead: ${lead.name}
Empresa: ${lead.company ?? "—"}
Email: ${lead.email ?? "—"}
Teléfono: ${lead.phone ?? "—"}
Origen: ${lead.source ?? "—"}
Estado actual: ${lead.status}
Notas: ${(lead.notes as string | null) ?? "—"}

Interacciones (cronológico, máx. 20):
${interactionsText || "(sin interacciones registradas)"}`;

  let result: AIResult;
  try {
    const raw = await runAIJson<unknown>({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: userPrompt,
    });
    result = ResultSchema.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI call failed";
    log.error({ leadId: body.lead_id, err: message }, "ai_summarize_failed");
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { error: updateErr } = await supabase
    .from("leads")
    .update({
      ai_summary: result.summary,
      ai_suggested_next_step: result.suggested_next_step,
      ai_temperature: result.temperature,
      ai_confidence: result.confidence,
      ai_updated_at: new Date().toISOString(),
    })
    .eq("id", body.lead_id);

  if (updateErr) {
    log.error({ leadId: body.lead_id, err: updateErr.message }, "ai_summarize_persist_failed");
    // Devolvemos el resultado aunque la persistencia haya fallado — el cliente
    // puede mostrarlo y reintentar el guardado.
    return NextResponse.json({ ok: true, persisted: false, ...result });
  }

  log.info({ leadId: body.lead_id, temperature: result.temperature }, "ai_summarize_ok");
  return NextResponse.json({ ok: true, persisted: true, ...result });
}
