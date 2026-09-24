import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIObject } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { formatLeadCallCopilotBriefing } from '@/lib/leads/ai-context'
import { removeDuplicateDiscoverySuggestions } from '@/lib/leads/discovery-questions'
import { getLeadDetail } from '@/lib/leads/queries'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const log = scopedLogger('ai.call-copilot')
const BodySchema = z.object({ lead_id: z.string().uuid() })
const TaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(800).default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
})
const ResultSchema = z.object({
  summary: z.string().min(1).max(700),
  decisions: z.array(z.string().max(180)).max(4).default([]),
  open_questions: z.array(z.string().max(180)).max(4).default([]),
  discovery_updates: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        suggested_answer: z.string().trim().min(1).max(1200),
        evidence_excerpt: z.string().max(700).default(''),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(6)
    .default([]),
  tasks: z.array(TaskSchema).max(4).default([]),
  follow_up_focus: z.string().max(240).default(''),
})

const SYSTEM_PROMPT = `Eres copiloto comercial para una agencia digital española. Resume SOLO la llamada marcada
como más reciente. Distingue lo acordado de lo que sigue abierto. Propón como máximo 4 tareas, y solo
cuando una acción se haya solicitado explícitamente o sea una consecuencia comercial inequívoca.
Sé breve: cada texto en una frase. No inventes fechas, presupuesto, alcance, compromisos ni responsables.
Para cada pregunta pendiente con ID que pueda responderse con claridad desde la llamada, devuelve una sugerencia
con el ID, la respuesta en lenguaje claro, una cita breve y literal como evidencia, y tu confianza. No marques
ninguna respuesta como confirmada: son propuestas para revisión humana. No resuelvas preguntas con inferencias.
Devuelve también en open_questions preguntas nuevas que haya que resolver en próximos contactos. No redactes un email.`

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) return NextResponse.json({ error: 'ai_disabled' }, { status: 503 })
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (user.role === 'viewer') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!rateLimit(`ai:call-copilot:${user.id}`, 10).success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'lead_id inválido' }, { status: 400 })
  }

  let detail: Awaited<ReturnType<typeof getLeadDetail>>
  try {
    detail = await getLeadDetail(body.lead_id)
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      'call_copilot_lead_failed',
    )
    return NextResponse.json({ error: 'lead_unavailable' }, { status: 502 })
  }
  if (!detail) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const hasCall = detail.interactions.some((item) => item.type === 'call')
  if (!hasCall) return NextResponse.json({ error: 'call_not_found' }, { status: 422 })

  try {
    const result = await runAIObject({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: formatLeadCallCopilotBriefing({
        lead: detail.lead,
        clientName: detail.linkedClientName,
        interactions: detail.interactions,
        proposals: detail.proposals,
        tasks: detail.tasks,
        discoveryQuestions: detail.discoveryQuestions,
      }),
      schema: ResultSchema,
      maxOutputTokens: 900,
    })
    const latestCall = detail.interactions.find((item) => item.type === 'call')
    const eligibleQuestions = detail.discoveryQuestions.filter(
      (question) =>
        ['open', 'needs_review'].includes(question.status) && question.answer_source !== 'manual',
    )
    const eligibleIds = new Set(eligibleQuestions.map((question) => question.id))
    const supabase = await createServerClient()
    const savedUpdates = await Promise.all(
      result.discovery_updates
        .filter((suggestion) => eligibleIds.has(suggestion.question_id))
        .map(async (suggestion) => {
          const { data, error } = await supabase
            .from('lead_discovery_questions')
            .update({
              suggested_answer: suggestion.suggested_answer,
              source_interaction_id: latestCall?.id ?? null,
              evidence_excerpt: suggestion.evidence_excerpt || null,
              confidence: suggestion.confidence,
              status: 'needs_review',
              updated_by: user.id,
            })
            .eq('id', suggestion.question_id)
            .eq('lead_id', body.lead_id)
            .in('status', ['open', 'needs_review'])
            .or('answer_source.is.null,answer_source.eq.ai')
            .select('id')
            .maybeSingle()
          if (error) throw error
          return data ? 1 : 0
        }),
    )
    const newQuestions = removeDuplicateDiscoverySuggestions(
      result.open_questions.map((question) => ({ question })),
      detail.discoveryQuestions,
    )
    if (newQuestions.length) {
      const { error } = await supabase.from('lead_discovery_questions').insert(
        newQuestions.map(({ question }) => ({
          lead_id: body.lead_id,
          question,
          category: 'other',
          rationale: 'Detectada al analizar una llamada; confirmar si conviene mantenerla.',
          priority: 2,
          origin: 'ai',
          created_by: user.id,
          updated_by: user.id,
        })),
      )
      if (error) throw error
    }
    const discoveryUpdatesSaved = savedUpdates.reduce<number>((total, count) => total + count, 0)
    log.info(
      { leadId: body.lead_id, tasks: result.tasks.length, discoveryUpdatesSaved, newQuestions: newQuestions.length },
      'call_copilot_ok',
    )
    return NextResponse.json({
      ok: true,
      ...result,
      discovery_updates_saved: discoveryUpdatesSaved,
      new_questions_added: newQuestions.length,
    })
  } catch (err) {
    log.error(
      { leadId: body.lead_id, err: err instanceof Error ? err.message : err },
      'call_copilot_failed',
    )
    return NextResponse.json({ error: 'ai_unavailable' }, { status: 502 })
  }
}
