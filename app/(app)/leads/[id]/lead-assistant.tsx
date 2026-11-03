'use client'

import { Drawer, DrawerDescription, DrawerHeader, DrawerTitle } from '@doscientos/ui'
import { MessageCircle } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { AssistantResponse } from '@/lib/leads/assistant-contract'
import { readJsonResponse } from '@/lib/utils/http'

import { LeadAssistantMessage } from './lead-assistant-message'

type Message = {
  id: number
  role: 'user' | 'assistant'
  content: string
  result?: AssistantResponse
}
const QUESTIONS = [
  '¿Qué quería este lead y qué quedó pendiente?',
  '¿Qué sabemos de su presupuesto y sus plazos?',
  'Prepara un email para retomar el contacto con lo que sabemos.',
]

export function LeadAssistant({ leadId }: { leadId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (messages.length === 0 && !loading) return
    end.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages.length, loading])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const message = question.trim()
    if (!message || request.current) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError(null)
    const history = messages.slice(-6).map((item) => ({
      role: item.role,
      content: (item.result?.draft
        ? `${item.content}\nBorrador: ${item.result.draft.title}\n${item.result.draft.body}`
        : item.content
      ).slice(0, 5000),
    }))
    const userMessageId = ++sequence.current
    setMessages((current) => [...current, { id: userMessageId, role: 'user', content: message }])
    setQuestion('')
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
      if (!response.ok) throw new Error(result.error || 'No se pudo consultar al asistente.')
      const assistantMessageId = ++sequence.current
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: result.answer,
          result,
        },
      ])
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'No se pudo consultar al asistente.')
        setQuestion(message)
      }
    } finally {
      request.current = null
      setLoading(false)
    }
  }

  return (
    <Drawer
      trigger={
        <Button variant="outline" size="sm">
          <MessageCircle className="size-4" aria-hidden />
          Preguntar sobre este lead
        </Button>
      }
      className="w-full sm:max-w-xl"
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <DrawerHeader className="pr-8">
          <DrawerTitle>Preguntar sobre este lead</DrawerTitle>
          <DrawerDescription>
            Consulta su historial y prepara borradores con fuentes. Nada se envía automáticamente.
          </DrawerDescription>
        </DrawerHeader>
        <div
          role="log"
          aria-label="Conversación del lead"
          aria-busy={loading}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1"
        >
          {messages.length === 0 ? (
            <div className="space-y-2">
              {QUESTIONS.map((text) => (
                <Button
                  key={text}
                  variant="outline"
                  className="h-auto w-full justify-start text-left whitespace-normal"
                  onClick={() => setQuestion(text)}
                >
                  {text}
                </Button>
              ))}
            </div>
          ) : null}
          {messages.map((item) =>
            item.result ? (
              <LeadAssistantMessage key={item.id} result={item.result} />
            ) : (
              <p
                key={item.id}
                className="ml-6 rounded-lg bg-primary/10 p-3 text-sm whitespace-pre-wrap"
              >
                {item.content}
              </p>
            ),
          )}
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Consultando historial y preparando respuesta…
            </p>
          ) : null}
          <div ref={end} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <form onSubmit={submit} className="space-y-2 border-t pt-3">
          <Textarea
            aria-label="Pregunta sobre el lead"
            placeholder="Pregunta por una reunión, un acuerdo o un email antiguo…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={loading}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              IA: puede equivocarse. Contexto parcial y conversación temporal; se pierde al salir de
              la ficha.
            </p>
            <Button type="submit" disabled={loading || !question.trim()}>
              Consultar
            </Button>
          </div>
        </form>
      </div>
    </Drawer>
  )
}
