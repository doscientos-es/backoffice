'use client'

import { Archive, Check, ChevronDown, ChevronUp, LoaderCircle, Plus, Sparkles, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { LeadDiscoveryQuestion } from '@/lib/leads/types'
import { readJsonResponse } from '@/lib/utils/http'

import {
  acceptLeadDiscoverySuggestion,
  createLeadDiscoveryQuestion,
  dismissLeadDiscoverySuggestion,
  saveLeadDiscoveryQuestion,
  setLeadDiscoveryQuestionStatus,
} from '../actions'

type Props = {
  leadId: string
  initialQuestions: LeadDiscoveryQuestion[]
  aiEnabled: boolean
  canEdit: boolean
}

const STATUS_LABEL: Record<LeadDiscoveryQuestion['status'], string> = {
  open: 'Pendiente',
  needs_review: 'Revisar propuesta IA',
  answered: 'Respondida',
  deferred: 'Pospuesta',
  not_applicable: 'No aplica',
  archived: 'Archivada',
}

export function LeadDiscoveryQuestionsPanel({ leadId, initialQuestions, aiEnabled, canEdit }: Props) {
  const router = useRouter()
  const [questions, setQuestions] = useState(initialQuestions)
  const [expanded, setExpanded] = useState(true)
  const [showResolved, setShowResolved] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setQuestions(initialQuestions), [initialQuestions])

  const visibleQuestions = useMemo(
    () =>
      questions.filter(
        (question) =>
          question.status !== 'archived' &&
          (showResolved || !['answered', 'not_applicable'].includes(question.status)),
      ),
    [questions, showResolved],
  )
  const resolvedCount = questions.filter((question) =>
    ['answered', 'not_applicable'].includes(question.status),
  ).length
  const unresolvedCount = questions.filter((question) =>
    ['open', 'needs_review'].includes(question.status),
  ).length

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canEdit || !newQuestion.trim()) return
    setBusy(true)
    setError(null)
    const result = await createLeadDiscoveryQuestion({
      leadId,
      question: newQuestion.trim(),
      category: 'other',
      rationale: '',
      priority: 2,
    })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setNewQuestion('')
    setAdding(false)
    router.refresh()
  }

  async function generateScript() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/crm/ai/discovery-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      })
      const json = await readJsonResponse<{ error?: string; added?: number }>(
        response,
        'No se pudo generar el guion.',
      )
      if (!response.ok) throw new Error(json.error ?? 'No se pudo generar el guion.')
      if (!json.added) setError('No han salido preguntas nuevas; el guion actual ya cubre el contexto conocido.')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar el guion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="flex min-w-0 items-center gap-2 text-left"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <CardTitle className="text-base">Preguntas por resolver</CardTitle>
            <Badge variant={unresolvedCount ? 'secondary' : 'outline'}>{unresolvedCount}</Badge>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
          {canEdit ? (
            <div className="flex shrink-0 gap-1">
              {aiEnabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Generar preguntas con IA"
                  title="Generar guion con IA"
                  disabled={busy}
                  onClick={generateScript}
                >
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label="Añadir pregunta"
                onClick={() => {
                  setExpanded(true)
                  setAdding((value) => !value)
                }}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          Guion vivo para entender alcance, operación y decisiones antes de proponer.
        </p>
      </CardHeader>
      {expanded ? (
        <CardContent className="flex flex-col gap-3 pt-0">
          {adding ? (
            <form onSubmit={addQuestion} className="flex flex-col gap-2">
              <Textarea
                autoFocus
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
                placeholder="¿Qué necesitas entender del proceso actual?"
                rows={3}
                maxLength={500}
                disabled={!canEdit || busy}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={busy || newQuestion.trim().length < 3}>
                  {busy ? 'Guardando…' : 'Añadir'}
                </Button>
              </div>
            </form>
          ) : null}

          {resolvedCount > 0 ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="self-start"
              aria-expanded={showResolved}
              onClick={() => setShowResolved((value) => !value)}
            >
              {showResolved ? 'Ocultar' : 'Mostrar'} resueltas ({resolvedCount})
            </Button>
          ) : null}

          {visibleQuestions.length ? (
            <div className="flex flex-col gap-3">
              {visibleQuestions.map((question) => (
                <DiscoveryQuestionCard
                  key={question.id}
                  leadId={leadId}
                  question={question}
                  canEdit={canEdit}
                  onChanged={() => router.refresh()}
                />
              ))}
            </div>
          ) : !adding ? (
            <p className="text-muted-foreground text-sm">
              {questions.some((question) => question.status !== 'archived')
                ? 'No hay preguntas pendientes ahora mismo.'
                : 'Aún no hay preguntas. Añade una o genera un guion inicial con IA.'}
            </p>
          ) : null}

          {error ? <p role="status" className="text-destructive text-xs">{error}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  )
}

function DiscoveryQuestionCard({
  leadId,
  question,
  canEdit,
  onChanged,
}: {
  leadId: string
  question: LeadDiscoveryQuestion
  canEdit: boolean
  onChanged: () => void
}) {
  const [questionDraft, setQuestionDraft] = useState(question.question)
  const [answerDraft, setAnswerDraft] = useState(question.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setQuestionDraft(question.question)
    setAnswerDraft(question.answer ?? '')
  }, [question])

  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (!result.ok) return setError(result.error ?? 'No se pudo guardar el cambio.')
    onChanged()
  }

  return (
    <article className="border-border flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground mb-1 text-[11px]">
            {question.category} · prioridad {question.priority} · {STATUS_LABEL[question.status]}
          </p>
          {canEdit ? (
            <Input
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              maxLength={500}
              aria-label="Pregunta de descubrimiento"
              className="h-auto min-h-8 border-0 px-0 py-1 font-medium shadow-none focus-visible:ring-0"
            />
          ) : (
            <p className="font-medium">{question.question}</p>
          )}
        </div>
        {question.origin === 'ai' ? <Badge variant="outline">IA</Badge> : null}
      </div>

      {question.rationale ? (
        <p className="text-muted-foreground text-xs leading-relaxed">{question.rationale}</p>
      ) : null}

      {question.suggested_answer ? (
        <div className="bg-primary/5 border-primary/15 flex flex-col gap-2 rounded-md border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium">Propuesta IA · por confirmar</span>
            {question.confidence != null ? (
              <span className="text-muted-foreground text-[11px]">
                {Math.round(question.confidence * 100)}% confianza
              </span>
            ) : null}
          </div>
          <p className="text-sm">{question.suggested_answer}</p>
          {question.evidence_excerpt ? (
            <blockquote className="text-muted-foreground border-border border-l-2 pl-2 text-xs italic">
              “{question.evidence_excerpt}”
            </blockquote>
          ) : null}
          {canEdit ? (
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                disabled={busy}
                onClick={() => void run(() => dismissLeadDiscoverySuggestion({ leadId, questionId: question.id }))}
              >
                <X className="size-3" /> Descartar
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={busy || question.answer_source === 'manual'}
                onClick={() => void run(() => acceptLeadDiscoverySuggestion({ leadId, questionId: question.id }))}
              >
                <Check className="size-3" /> Confirmar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="text-muted-foreground text-xs" htmlFor={`answer-${question.id}`}>
        Respuesta confirmada
      </label>
      <Textarea
        id={`answer-${question.id}`}
        value={answerDraft}
        onChange={(event) => setAnswerDraft(event.target.value)}
        placeholder="Anota la respuesta abierta…"
        rows={2}
        maxLength={2000}
        disabled={!canEdit || busy}
      />
      {question.answer_source ? (
        <p className="text-muted-foreground text-[11px]">
          {question.answer_source === 'manual' ? 'Respuesta editada manualmente' : 'Respuesta confirmada desde sugerencia IA'}
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void run(() =>
                setLeadDiscoveryQuestionStatus({ leadId, questionId: question.id, status: 'deferred' }),
              )
            }
          >
            Posponer
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={busy}
            aria-label="Archivar pregunta"
            onClick={() =>
              void run(() =>
                setLeadDiscoveryQuestionStatus({ leadId, questionId: question.id, status: 'archived' }),
              )
            }
          >
            <Archive className="size-3" />
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={busy || questionDraft.trim().length < 3}
            onClick={() =>
              void run(() =>
                saveLeadDiscoveryQuestion({
                  leadId,
                  questionId: question.id,
                  question: questionDraft.trim(),
                  answer: answerDraft,
                  rationale: question.rationale,
                }),
              )
            }
          >
            {busy ? <LoaderCircle className="size-3 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-destructive text-xs">{error}</p> : null}
    </article>
  )
}