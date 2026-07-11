/**
 * POST /api/projects/[id]/generate-client-update
 *
 * Genera un update profesional para el cliente basado en el estado actual del
 * proyecto, sus tareas y los registros de trabajo recientes.
 *
 * No persiste nada — devuelve el texto listo para copiar y enviar.
 */

import { AI_MODELS, isAIEnabled, runAIChat } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { scopedLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("ai.generate-client-update");

const SYSTEM_PROMPT = `Eres el jefe de proyecto de una agencia de desarrollo web española.
Escribe un update de progreso profesional, claro y conciso en ESPAÑOL para enviar al cliente.

El update debe:
- Empezar con un saludo profesional.
- Resumir los avances recientes de forma comprensible (sin jerga técnica).
- Mencionar el estado general del proyecto.
- Indicar los próximos pasos previstos.
- Terminar con una frase de cierre positiva y profesional.
- Tono: profesional pero cercano, como el de una agencia española de confianza.
- Longitud: 3-5 párrafos. No uses markdown, solo texto plano.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const supabase = await createServerClient();

  const [{ data: project }, { data: tasks }, { data: workLogs }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, notes, description, clients(name)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("title, status, description")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("work_logs")
      .select("work_date, hours, note")
      .eq("project_id", id)
      .is("deleted_at", null)
      .order("work_date", { ascending: false })
      .limit(10),
  ]);

  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const client = (project as unknown as { clients: { name: string } | null }).clients;

  const tasksByStatus = (tasks ?? []).reduce<Record<string, string[]>>((acc, t) => {
    const status = t.status as string;
    acc[status] = acc[status] ?? [];
    acc[status].push(t.title as string);
    return acc;
  }, {});

  const tasksText = Object.entries(tasksByStatus)
    .map(([status, titles]) => `${status}: ${titles.join(", ")}`)
    .join("\n");

  const workText = (workLogs ?? [])
    .map((w) => `- ${w.work_date}: ${w.hours}h${w.note ? ` — ${(w.note as string).slice(0, 150)}` : ""}`)
    .join("\n");

  const userPrompt = `Proyecto: ${project.name}
Cliente: ${client?.name ?? "—"}
Estado del proyecto: ${project.status}
Descripción: ${(project.description as string | null) ?? "—"}
Notas internas: ${(project.notes as string | null) ?? "—"}

Tareas (agrupadas por estado):
${tasksText || "(sin tareas registradas)"}

Registros de trabajo recientes:
${workText || "(sin registros de trabajo)"}`;

  try {
    const update = await runAIChat({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: userPrompt,
      temperature: 0.4,
      maxOutputTokens: 800,
    });

    log.info({ projectId: id }, "ai_client_update_ok");
    return NextResponse.json({ ok: true, update });
  } catch (err) {
    log.error({ projectId: id, err: err instanceof Error ? err.message : err }, "ai_client_update_failed");
    return NextResponse.json({ error: "AI service unavailable" }, { status: 502 });
  }
}
