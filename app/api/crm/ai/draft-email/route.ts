/**
 * POST /api/crm/ai/draft-email
 *
 * Genera un borrador de email (asunto + cuerpo en Markdown) para un lead.
 * El cuerpo se emite en Markdown porque el composer y sendEmailToLead lo
 * convierten a HTML con markdownToHtml. NO envía el email ni lo persiste — el
 * equipo SIEMPRE revisa antes de enviar (sec. 22.2 description.md).
 *
 * Body: { lead_id: string, kind?: string, instructions?: string }
 *  - kind: tipo de email deseado (p.ej. "follow_up", "intro", "propuesta")
 *  - instructions: notas adicionales libres del usuario
 *
 * Auth: requireUser (viewer denegado). 503 si la IA no está configurada.
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

const log = scopedLogger("ai.draft-email");

const BodySchema = z.object({
  lead_id: z.string().uuid(),
  kind: z.string().max(40).optional(),
  instructions: z.string().max(1000).optional(),
});

const ResultSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});
type AIResult = z.infer<typeof ResultSchema>;

const SYSTEM_PROMPT = `Eres un asistente de CRM que redacta emails en español
para una agencia de desarrollo web. Tono profesional, cercano, sin tecnicismos
innecesarios. Redacta el cuerpo en Markdown simple (párrafos, **negrita**,
listas con "-"), sin encabezados ni HTML.

- "subject": asunto del email (máx. 100 caracteres).
- "body": cuerpo del email en Markdown.

La firma del usuario se añade aparte; no la incluyas en el body.`;

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
    .select("id, name, company, email, source, status, notes")
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
    .limit(5);

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
Origen: ${lead.source ?? "—"}
Estado actual: ${lead.status}
Notas: ${(lead.notes as string | null) ?? "—"}

Últimas 5 interacciones (cronológico):
${interactionsText || "(sin interacciones previas)"}

Tipo de email solicitado: ${body.kind ?? "follow_up"}
Instrucciones del remitente: ${body.instructions ?? "—"}

Remitente: ${user.name} (${user.email})`;

  let result: AIResult;
  try {
    result = await runAIObject({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: ResultSchema,
      temperature: 0.6, // un poco más de variedad para emails
      maxOutputTokens: 1000,
    });
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      "ai_draft_email_failed",
    );
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }

  log.info({ leadId: body.lead_id, kind: body.kind ?? "follow_up" }, "ai_draft_email_ok");
  return NextResponse.json({ ok: true, ...result });
}
