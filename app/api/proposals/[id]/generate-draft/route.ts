/**
 * Prepares the editable narrative of a lead proposal from the CRM briefing.
 * The result is returned for review; the editor is responsible for persisting
 * it once it has received a valid structured response.
 */
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AI_MODELS, isAIEnabled, runAIObject } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { formatLeadBriefingForAI } from "@/lib/leads/ai-context";
import { getLeadDetail } from "@/lib/leads/queries";
import { scopedLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = scopedLogger("ai.generate-proposal-draft");

const PairSchema = z.object({
  problem: z.string().min(1).max(200),
  problemDescription: z.string().max(2000).default(""),
  solution: z.string().min(1).max(200),
  solutionDescription: z.string().max(2000).default(""),
});

const ResultSchema = z.object({
  title: z.string().min(1).max(200),
  context_markdown: z.string().min(1).max(20_000),
  notes: z.string().max(4000).default(""),
  terms: z.string().max(20_000).default(""),
  pairs: z.array(PairSchema).min(1).max(5),
});

const SYSTEM_PROMPT = `Eres un consultor senior de una agencia española de producto digital.
Prepara un primer borrador de propuesta, en español, para que un equipo lo revise y edite.

Devuelve solamente un objeto JSON con title, context_markdown, notes, terms y pairs.
- context_markdown: 2-3 frases que expliquen la situación y necesidad del lead.
- pairs: entre 2 y 5 pares de problema y solución, concretos y directamente relacionados.
- notes: aclaraciones de alcance que consten explícitamente en el briefing; deja "" si no hay.
- terms: solo condiciones, pagos, plazos o vigencia mencionados explícitamente en el briefing; deja "" si no hay.
- title: título profesional y específico, sin inventar un producto, precio o alcance.

Reglas estrictas: usa únicamente el briefing como fuente de verdad; no inventes precios,
plazos, condiciones, integraciones, compromisos ni datos del cliente. No conviertas hipótesis
en hechos y no incluyas texto fuera del objeto JSON.`;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAIEnabled()) return NextResponse.json({ error: "ai_disabled" }, { status: 503 });

  let user: Awaited<ReturnType<typeof requireUser>>;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (user.role === "viewer") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!rateLimit(`ai:${user.id}`, 10).success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { id } = await params;
  const supabase = await createServerClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, lead_id")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!proposal) return NextResponse.json({ error: "proposal_not_found" }, { status: 404 });

  const leadId = proposal.lead_id as string | null;
  if (!leadId) {
    return NextResponse.json(
      { error: "Esta propuesta no está vinculada a un lead con contexto CRM." },
      { status: 422 },
    );
  }

  const lead = await getLeadDetail(leadId);
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });

  const briefing = formatLeadBriefingForAI({
    lead: lead.lead,
    clientName: lead.linkedClientName,
    interactions: lead.interactions,
    proposals: lead.proposals,
    projects: lead.projects,
    invoices: lead.invoices,
    tasks: lead.tasks,
    reminders: lead.reminders,
    attachments: lead.attachments,
  });

  try {
    const draft = await runAIObject({
      model: AI_MODELS.drafter,
      system: SYSTEM_PROMPT,
      user: briefing,
      schema: ResultSchema,
      temperature: 0.3,
      maxOutputTokens: 2600,
    });
    log.info(
      { proposalId: id, leadId, pairs: draft.pairs.length },
      "ai_generate_proposal_draft_ok",
    );
    return NextResponse.json({ ok: true, ...draft });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI call failed";
    log.error({ proposalId: id, leadId, err: message }, "ai_generate_proposal_draft_failed");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
