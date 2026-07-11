/**
 * POST /api/crm/ai/extract-tasks
 *
 * Analiza las notas e interacciones de un lead y extrae una lista de tareas accionables.
 * No persiste nada — devuelve sugerencias para que el usuario las revise y cree.
 *
 * Body: { lead_id: string }
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

const log = scopedLogger("ai.extract-tasks");

const BodySchema = z.object({ lead_id: z.string().uuid() });

const TaskSuggestion = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(""),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

const ResultSchema = z.object({
  tasks: z.array(TaskSuggestion).min(1).max(8),
});

const SYSTEM_PROMPT = `Eres un asistente de CRM para una agencia de desarrollo web española.
Analiza la información de un lead y sus interacciones recientes y extrae entre 1 y 8 tareas
accionables concretas que el equipo comercial debería realizar para avanzar con este lead.

Para cada tarea devuelve:
- "title": título corto y accionable (máx 200 chars). Empieza con un verbo (Llamar, Enviar, Preparar…).
- "description": contexto breve de por qué es necesaria (máx 500 chars, puede ser vacío).
- "priority": "low" | "medium" | "high" | "urgent" según la urgencia percibida.

Devuelve SOLO tareas que tengan sentido y valor real. No inventes información.`;

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
  if (!rl.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "lead_id requerido" }, { status: 400 });
  }

  const supabase = await createServerClient();

  const [{ data: lead }, { data: interactions }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, company, status, notes, ai_summary")
      .eq("id", body.lead_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("lead_interactions")
      .select("type, subject, body, created_at")
      .eq("lead_id", body.lead_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

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
Estado: ${lead.status}
Notas: ${(lead.notes as string | null) ?? "—"}
Resumen IA existente: ${(lead.ai_summary as string | null) ?? "—"}

Interacciones recientes:
${interactionsText || "(sin interacciones)"}`;

  try {
    const result = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      schema: ResultSchema,
      maxOutputTokens: 800,
    });

    log.info({ leadId: body.lead_id, count: result.tasks.length }, "ai_extract_tasks_ok");
    return NextResponse.json({ ok: true, tasks: result.tasks });
  } catch (err) {
    log.error({ leadId: body.lead_id, err: err instanceof Error ? err.message : err }, "ai_extract_tasks_failed");
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }
}
