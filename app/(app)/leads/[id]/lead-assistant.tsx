'use client'

import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from '@doscientos/ui'
import { LoaderCircle, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { useAssistantConversation } from '@/components/leads/assistant-session-provider'
import { Button } from '@/components/ui/button'
import type { AssistantResponse } from '@/lib/leads/assistant-contract'
import { readJsonResponse } from '@/lib/utils/http'

import { LeadAssistantComposer } from './lead-assistant-composer'
import { LeadAssistantMessage } from './lead-assistant-message'
import { LeadAssistantWelcome } from './lead-assistant-welcome'

export function LeadAssistantConversation({
  leadId,
  duringCall = false,
}: {
  leadId: string
  duringCall?: boolean
}) {
  const { messages, question, ready, persisted, generation, update, reset } =
    useAssistantConversation(leadId)
  const setQuestion = (value: string) => update((current) => ({ ...current, question: value }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  // Reset/expiry, cross-tab updates and logout invalidate pending answers too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation and leadId identify the active conversation, not its individual messages.
  useEffect(() => {
    setLoading(false)
    setError(null)
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [generation, leadId])
  useEffect(() => {
    if (messages.length === 0 && !loading) return
    end.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages.length, loading])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const message = question.trim()
    if (!ready || !message || request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(null)
    const history = messages.slice(-6).map((item) => ({
      role: item.role,
      content: (item.role === 'assistant' && item.result.draft
        ? `${item.content}\nBorrador: ${item.result.draft.title}\n${item.result.draft.body}`
        : item.content
      ).slice(0, 5000),
    }))
    const userMessageId = Math.max(0, ...messages.map((item) => item.id)) + 1
    update((current) => ({
      question: '',
      messages: [...current.messages, { id: userMessageId, role: 'user', content: message }],
    }))
    try {
      const response = await fetch('/api/crm/ai/lead-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, message, history }),
        signal: controller.signal,
      })
      const result = await readJsonResponse<AssistantResponse & { error?: string }>(
        response,
        'No se pudo consultar al asistente.',
      )
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error(result.error || 'No se pudo consultar al asistente.')
      update((current) => ({
        ...current,
        messages: [
          ...current.messages,
          {
            id: Math.max(0, ...current.messages.map((item) => item.id)) + 1,
            role: 'assistant',
            content: result.answer,
            result,
          },
        ],
      }))
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'No se pudo consultar al asistente.')
        update((current) => ({
          messages: current.messages.filter((item) => item.id !== userMessageId),
          question: message,
        }))
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setLoading(false)
      }
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-2 sm:px-6">
        <p className="text-xs text-muted-foreground">
          Historial local · 7 días · hasta 50 mensajes
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!ready || (!messages.length && !question && !loading)}
          onClick={() => {
            reset()
            input.current?.focus()
          }}
          className="gap-1.5"
        >
          <Plus className="size-3.5" aria-hidden />
          Nueva conversación
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
        {messages.length === 0 ? (
          <LeadAssistantWelcome
            duringCall={duringCall}
            onSelect={(value) => {
              setQuestion(value)
              input.current?.focus()
            }}
          />
        ) : null}
        <div
          role="log"
          aria-label="Conversación del lead"
          aria-busy={loading}
          className="space-y-7"
        >
          {messages.map((item) =>
            item.role === 'assistant' ? (
              <LeadAssistantMessage
                key={item.id}
                result={item.result}
                onDraftChange={(draft) =>
                  update((current) => ({
                    ...current,
                    messages: current.messages.map((message) =>
                      message.id === item.id && message.role === 'assistant'
                        ? { ...message, result: { ...message.result, draft } }
                        : message,
                    ),
                  }))
                }
              />
            ) : (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[90%] min-w-0 space-y-1.5">
                  <p className="pr-1 text-right text-xs font-medium text-muted-foreground">Tú</p>
                  <p className="rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-primary-foreground">
                    {item.content}
                  </p>
                </div>
              </div>
            ),
          )}
          {loading ? (
            <div role="status" className="flex items-center gap-3 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden />
              </span>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Buscando en el historial</p>
                <p className="text-xs text-muted-foreground">
                  Reuniendo contexto para responderte…
                </p>
              </div>
            </div>
          ) : null}
          <div ref={end} />
        </div>
      </div>
      <LeadAssistantComposer
        question={question}
        loading={loading}
        error={error}
        duringCall={duringCall}
        ready={ready}
        persisted={persisted}
        inputRef={input}
        onQuestionChange={setQuestion}
        onSubmit={submit}
      />
    </div>
  )
}

export function LeadAssistant({ leadId, leadName }: { leadId: string; leadName?: string }) {
  return (
    <Drawer
      trigger={
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/20 bg-primary/5 text-primary"
        >
          <Sparkles className="size-4" aria-hidden />
          Preguntar sobre este lead
        </Button>
      }
      className="gap-0 overflow-hidden bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        <DrawerHeader className="shrink-0 gap-4 border-b border-border/60 bg-card px-4 py-5 pr-14 sm:px-6 sm:pr-14">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 space-y-0.5">
              <DrawerTitle className="flex items-center gap-2">
                Asistente del lead
                <span className="rounded-md bg-accent/40 px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                  IA
                </span>
              </DrawerTitle>
              <DrawerDescription className="block truncate" title={leadName}>
                {leadName || 'Historial, reuniones y acuerdos'}
              </DrawerDescription>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Solo consulta y borradores. Nada se envía automáticamente.
          </p>
        </DrawerHeader>
        <LeadAssistantConversation leadId={leadId} />
      </div>
    </Drawer>
  )
}
