'use client'

import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  ListChecks,
  Plus,
  Sparkles,
  X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useId, useMemo, useState } from 'react'

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

const STATUS_TONE: Record<LeadDiscoveryQuestion['status'], string> = {
  open: 'border-primary/20 bg-primary/5 text-primary',
  needs_review: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  answered: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  deferred: 'border-border bg-muted/60 text-muted-foreground',
  not_applicable: 'border-border bg-muted/60 text-muted-foreground',
  archived: 'border-border bg-muted/60 text-muted-foreground',
}

const CATEGORY_LABEL: Record<string, string> = {
  workflow: 'Proceso',
  users: 'Usuarios',
  scope: 'Alcance',
  integrations: 'Integraciones',
  data: 'Datos',
  budget: 'Presupuesto',
  decision: 'Decisión',
  timeline: 'Calendario',
  other: 'General',
}

export function LeadDiscoveryQuestionsPanel({
  leadId,
  initialQuestions,
  aiEnabled,
  canEdit,
}: Props) {
  const router = useRouter()
  const contentId = useId()
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
  const openCount = questions.filter((question) => question.status === 'open').length
  const reviewCount = questions.filter((question) => question.status === 'needs_review').length
  const deferredCount = questions.filter((question) => question.status === 'deferred').length
  const unresolvedCount = openCount + reviewCount + deferredCount
  const statusSummary = [
    openCount ? `${openCount} ${openCount === 1 ? 'abierta' : 'abiertas'}` : '',
    reviewCount ? `${reviewCount} por revisar` : '',
    deferredCount ? `${deferredCount} ${deferredCount === 1 ? 'pospuesta' : 'pospuestas'}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  const headerSummary =
    statusSummary || (resolvedCount ? 'Guion cubierto por ahora' : 'Prepara la conversación')

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
      if (!json.added)
        setError('No han salido preguntas nuevas; el guion actual ya cubre el contexto conocido.')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar el guion.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-border/80 shadow-sm transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none">
      <CardHeader className="border-border/70 bg-muted/20 flex-row items-center justify-between gap-3 space-y-0 border-b pb-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CardTitle className="min-w-0 flex-1">
            <button
              type="button"
              className="group focus-visible:ring-ring/50 flex w-full min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2"
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => setExpanded((value) => !value)}
            >
              <span className="bg-primary/10 text-primary ring-primary/10 flex size-9 shrink-0 items-center justify-center rounded-xl ring-1">
                <ListChecks className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold">Preguntas por resolver</span>
                  <Badge
                    variant={unresolvedCount ? 'secondary' : 'outline'}
                    className="shrink-0 transition-colors duration-200"
                  >
                    {unresolvedCount}
                  </Badge>
                </span>
                <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal">
                  {headerSummary}
                </span>
              </span>
              <ChevronDown
                className={`text-muted-foreground size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
          </CardTitle>
          {canEdit ? (
            <div className="flex shrink-0 gap-1">
              {aiEnabled ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-primary hover:bg-primary/10"
                  aria-label="Generar preguntas con IA"
                  title="Generar guion con IA"
                  disabled={busy}
                  onClick={generateScript}
                >
                  {busy ? (
                    <LoaderCircle className="size-4 motion-safe:animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="hover:border-primary/30 hover:text-primary"
                aria-label="Añadir pregunta"
                title="Añadir pregunta"
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
      </CardHeader>
      <div
        id={contentId}
        aria-hidden={!expanded}
        inert={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
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
                <ChevronDown
                  className={`size-3 transition-transform duration-200 motion-reduce:transition-none ${showResolved ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </Button>
            ) : null}

            {visibleQuestions.length ? (
              <div className="flex flex-col gap-2.5">
                {visibleQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
                    style={{ animationDelay: `${Math.min(index, 5) * 35}ms` }}
                  >
                    <DiscoveryQuestionCard
                      leadId={leadId}
                      question={question}
                      canEdit={canEdit}
                      onChanged={() => router.refresh()}
                    />
                  </div>
                ))}
              </div>
            ) : !adding ? (
              <div className="border-border bg-muted/20 motion-safe:animate-in motion-safe:fade-in rounded-xl border border-dashed px-4 py-5 text-center motion-safe:duration-200">
                {questions.some((question) => question.status !== 'archived') ? (
                  <CheckCircle2
                    className="mx-auto mb-2 size-5 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <ListChecks
                    className="text-muted-foreground mx-auto mb-2 size-5"
                    aria-hidden="true"
                  />
                )}
                <p className="text-sm font-medium">
                  {questions.some((question) => question.status !== 'archived')
                    ? 'Todo cubierto por ahora'
                    : 'Prepara el discovery'}
                </p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-56 text-xs leading-relaxed">
                  {questions.some((question) => question.status !== 'archived')
                    ? 'No quedan preguntas pendientes. Puedes mostrar las resueltas para repasar.'
                    : 'Añade una pregunta o genera un guion con IA para empezar.'}
                </p>
              </div>
            ) : null}

            {error ? (
              <p
                role="status"
                className="bg-destructive/10 text-destructive rounded-md px-2.5 py-2 text-xs"
              >
                {error}
              </p>
            ) : null}
          </CardContent>
        </div>
      </div>
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
    <article
      data-status={question.status}
      className="group/question border-border/80 bg-card hover:border-primary/25 flex flex-col gap-3 rounded-xl border p-3 shadow-sm transition-[border-color,box-shadow] duration-200 hover:shadow-md motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-border/70 bg-muted/30 h-5 px-1.5 text-[10px] font-medium"
            >
              {CATEGORY_LABEL[question.category] ?? question.category}
            </Badge>
            <Badge
              variant="outline"
              className={`h-5 px-1.5 text-[10px] font-medium ${question.priority === 1 ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border/70 text-muted-foreground'}`}
              aria-label={`Prioridad ${question.priority === 1 ? 'alta' : question.priority === 3 ? 'baja' : 'media'}`}
            >
              {question.priority === 1
                ? 'Prioridad alta'
                : question.priority === 3
                  ? 'Prioridad baja'
                  : 'Prioridad media'}
            </Badge>
            <Badge
              variant="outline"
              className={`h-5 px-1.5 text-[10px] font-medium ${STATUS_TONE[question.status]}`}
            >
              {STATUS_LABEL[question.status]}
            </Badge>
          </div>
          {canEdit ? (
            <Input
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              maxLength={500}
              aria-label={`Editar pregunta: ${question.question}`}
              className="hover:bg-muted/50 focus-visible:bg-background focus-visible:ring-primary/30 -mx-1 h-auto min-h-8 rounded-md border-0 px-1 py-1 leading-snug font-medium shadow-none transition-colors focus-visible:ring-2"
            />
          ) : (
            <p className="text-sm leading-snug font-medium">{question.question}</p>
          )}
        </div>
        {question.origin === 'ai' ? <Badge variant="outline">IA</Badge> : null}
      </div>

      {question.rationale ? (
        <p className="text-muted-foreground border-primary/20 border-l-2 pl-2 text-xs leading-relaxed">
          {question.rationale}
        </p>
      ) : null}

      {question.suggested_answer ? (
        <div className="border-primary/20 bg-primary/5 flex flex-col gap-2.5 rounded-lg border p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="text-primary size-3.5" aria-hidden="true" />
              Propuesta IA · por confirmar
            </span>
            {question.confidence != null ? (
              <span className="text-muted-foreground bg-background/70 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                {Math.round(question.confidence * 100)}% confianza
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed">{question.suggested_answer}</p>
          {question.evidence_excerpt ? (
            <blockquote className="text-muted-foreground border-border/70 bg-background/50 rounded-r-md border-l-2 py-1 pl-2.5 text-xs leading-relaxed italic">
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
                onClick={() =>
                  void run(() =>
                    dismissLeadDiscoverySuggestion({ leadId, questionId: question.id }),
                  )
                }
              >
                <X className="size-3" /> Descartar
              </Button>
              <Button
                type="button"
                size="xs"
                disabled={busy || question.answer_source === 'manual'}
                onClick={() =>
                  void run(() => acceptLeadDiscoverySuggestion({ leadId, questionId: question.id }))
                }
              >
                <Check className="size-3" /> Confirmar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          className="text-muted-foreground text-xs font-medium"
          htmlFor={`answer-${question.id}`}
        >
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
          className="bg-background/70 min-h-[72px] resize-y text-sm leading-relaxed transition-shadow motion-reduce:transition-none"
        />
      </div>
      {question.answer_source ? (
        <p className="text-muted-foreground -mt-1 flex items-center gap-1.5 text-[11px]">
          <CheckCircle2 className="size-3 text-emerald-600" aria-hidden="true" />
          {question.answer_source === 'manual'
            ? 'Respuesta editada manualmente'
            : 'Respuesta confirmada desde sugerencia IA'}
        </p>
      ) : null}

      {canEdit ? (
        <div className="border-border/60 flex items-center justify-between gap-2 border-t pt-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="text-muted-foreground"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setLeadDiscoveryQuestionStatus({
                    leadId,
                    questionId: question.id,
                    status: 'deferred',
                  }),
                )
              }
            >
              Posponer
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              disabled={busy}
              aria-label="Archivar pregunta"
              title="Archivar pregunta"
              onClick={() =>
                void run(() =>
                  setLeadDiscoveryQuestionStatus({
                    leadId,
                    questionId: question.id,
                    status: 'archived',
                  }),
                )
              }
            >
              <Archive className="size-3.5" />
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-w-20"
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
            {busy ? <LoaderCircle className="size-3.5 motion-safe:animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-2.5 py-2 text-xs"
        >
          {error}
        </p>
      ) : null}
    </article>
  )
}
