/**
 * POST /api/crm/ai/summarize-call-notes
 *
 * Resume las notas de una llamada para que quepan en el límite de 8.000
 * caracteres de `lead_interactions.body`. No persiste nada: el usuario revisa
 * el resultado en el formulario antes de guardar la llamada.
 *
 * Body: { text: string }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { AI_MODELS, isAIEnabled, runAIChat } from '@/lib/ai'
import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { rateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const log = scopedLogger('ai.summarize-call-notes')
const MAX_INPUT_LENGTH = 50_000
const MAX_OUTPUT_LENGTH = 8_000

const BodySchema = z.object({
  text: z.string().min(1).max(MAX_INPUT_LENGTH),
})

const SYSTEM_PROMPT = `Eres un asistente que resume notas automáticas de reuniones de Google Meet para un CRM.
Resume el texto en español, manteniendo los hechos importantes, decisiones, necesidades, dudas y próximos pasos.
No inventes información ni añadas introducciones o conclusiones genéricas.
Devuelve solo el resumen, sin comentarios sobre el proceso.
El resultado debe tener como máximo 7.700 caracteres; prioriza la información accionable y elimina repeticiones.`

function fitWithinLimit(text: string): string {
  const normalized = text.trim()
  if (normalized.length <= MAX_OUTPUT_LENGTH) return normalized

  const candidate = normalized.slice(0, MAX_OUTPUT_LENGTH)
  const lastSentence = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('\n'))
  return candidate
    .slice(0, lastSentence > MAX_OUTPUT_LENGTH * 0.75 ? lastSentence + 1 : MAX_OUTPUT_LENGTH)
    .trimEnd()
}

export async function POST(req: NextRequest) {
  if (!isAIEnabled()) {
    return NextResponse.json({ error: 'ai_disabled' }, { status: 503 })
  }

  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const rl = rateLimit(`ai:summarize-call-notes:${user.id}`, 10)
  if (!rl.success) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json(
      { error: 'text requerido (máximo 50.000 caracteres)' },
      { status: 400 },
    )
  }

  try {
    const text = await runAIChat({
      model: AI_MODELS.summarizer,
      system: SYSTEM_PROMPT,
      user: `Notas de la llamada:\n\n${body.text}`,
      maxOutputTokens: 1_800,
    })
    const summary = fitWithinLimit(text)
    if (!summary) throw new Error('La IA no devolvió un resumen.')

    log.info(
      { inputLength: body.text.length, outputLength: summary.length, userId: user.id },
      'ai_call_notes_summary_ok',
    )
    return NextResponse.json({ ok: true, text: summary })
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : err, userId: user.id },
      'ai_call_notes_summary_failed',
    )
    return NextResponse.json({ error: 'AI service unavailable' }, { status: 502 })
  }
}
