/**
 * POST /api/crm/ai/summarize-lead
 *
 * Genera un resumen + siguiente paso + temperatura + confianza para un lead.
 * Persiste el resultado en leads.ai_* (sec. 22.1 description.md).
 *
 * Body: { lead_id: string }
 * Auth: requireUser (viewer denegado — la operación escribe en el lead).
 *
 * Devuelve 503 si la IA no está configurada — el feature-gate vive en
 * isAIEnabled() para que el frontend pueda detectarlo y mostrar <AiNotice/>.
 */

import { AI_MODELS, isAIEnabled, runAIObject } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { scopedLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("ai.summarize-lead");

const BodySchema = z.object({
  lead_id: z.string().uuid(),
  force: z.boolean().optional().default(false),
});

const TEMPERATURES = ["hot", "warm", "cold"] as const;
const ResultSchema = z.object({
  summary: z.string().min(1).max(2000),
  suggested_next_step: z.string().min(1).max(500),
  temperature: z.enum(TEMPERATURES),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string().max(40)).max(5).default([]),
});
type AIResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = `Eres un asistente de CRM para una agencia de desarrollo web española.
Analiza la información del lead y sus interacciones y devuelve:
- "summary": resumen en 2-3 frases en español.
- "suggested_next_step": acción concreta recomendada (1 frase).
- "temperature": "hot" | "warm" | "cold".
- "confidence": número entre 0.0 y 1.0.
- "tags": array de 1-5 etiquetas cortas (máx 40 chars cada una) que categoricen al lead.
  Ejemplos: "E-commerce", "Presupuesto alto", "Urgente", "Startup", "Legacy refactor",
  "Interés en IA", "Sin contactar", "Empresa grande", "SaaS", "App móvil".
  Usa solo etiquetas que puedas inferir con seguridad de los datos.`;

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: "ai_disabled" }, { status: 503 });
  }

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (user.role === "viewer") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const rl = rateLimit(`ai:${user.id}`, 10);
  if (!rl.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
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
    .select(
      "id, name, company, email, phone, source, status, notes, updated_at, ai_summary, ai_suggested_next_step, ai_temperature, ai_confidence, ai_updated_at, ai_tags",
    )
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
    .limit(12); // Reducido de 20 a 12 para ahorrar tokens de entrada

  // --- CACHE CHECK ---
  if (!body.force && lead.ai_updated_at) {
    const aiTs = new Date(lead.ai_updated_at).getTime();
    const leadTs = new Date(lead.updated_at).getTime();
    const lastInteraction = interactions?.[0];
    const interactionTs = lastInteraction ? new Date(lastInteraction.created_at).getTime() : 0;

    // Si el lead no ha cambiado (margen 1s) y no hay interacciones nuevas, devolvemos cache
    if (aiTs >= leadTs - 1000 && aiTs >= interactionTs) {
      log.info({ leadId: body.lead_id }, "ai_summarize_cache_hit");
      return NextResponse.json({
        ok: true,
        cached: true,
        summary: lead.ai_summary,
        suggested_next_step: lead.ai_suggested_next_step,
        temperature: lead.ai_temperature,
        confidence: lead.ai_confidence,
        tags: lead.ai_tags ?? [],
        ai_updated_at: lead.ai_updated_at,
      });
    }
  }

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
    result = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: ResultSchema,
      maxOutputTokens: 600,
    });
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      "ai_summarize_failed",
    );
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from("leads")
    .update({
      ai_summary: result.summary,
      ai_suggested_next_step: result.suggested_next_step,
      ai_temperature: result.temperature,
      ai_confidence: result.confidence,
      ai_tags: result.tags.length > 0 ? result.tags : null,
      ai_updated_at: now,
    })
    .eq("id", body.lead_id);

  if (updateErr) {
    log.error({ leadId: body.lead_id, err: updateErr.message }, "ai_summarize_persist_failed");
    // Devolvemos el resultado aunque la persistencia haya fallado — el cliente
    // puede mostrarlo y reintentar el guardado.
    return NextResponse.json({ ok: true, persisted: false, ...result, ai_updated_at: now });
  }

  log.info({ leadId: body.lead_id, temperature: result.temperature }, "ai_summarize_ok");
  return NextResponse.json({ ok: true, persisted: true, ...result, ai_updated_at: now });
}
