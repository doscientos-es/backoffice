'use client'

import { Eye, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MARKETING_VARIABLES, personalizeMarketingText } from '@/lib/marketing/personalization'

type Field = 'subject' | 'previewText' | 'bodyMarkdown'
type Message = Record<Field, string>
const SAMPLE = { name: 'Ana', company: 'Acme', email: 'ana@example.test' }

export function MessageFields({ id, initial }: { id: string; initial?: Partial<Message> }) {
  const defaults = {
    subject: initial?.subject ?? '',
    previewText: initial?.previewText ?? '',
    bodyMarkdown: initial?.bodyMarkdown ?? '',
  }
  const [message, setMessage] = useState(defaults)
  const [active, setActive] = useState<Field>('bodyMarkdown')
  const container = useRef<HTMLDivElement>(null)
  const refs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement>>>({})

  useEffect(() => {
    const form = container.current?.closest('form')
    const reset = () =>
      setMessage({
        subject: initial?.subject ?? '',
        previewText: initial?.previewText ?? '',
        bodyMarkdown: initial?.bodyMarkdown ?? '',
      })
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [initial?.subject, initial?.previewText, initial?.bodyMarkdown])

  function insert(key: string) {
    const el = refs.current[active]
    const start = el?.selectionStart ?? message[active].length
    const end = el?.selectionEnd ?? start
    const token = `{{${key}}}`
    setMessage((current) => ({
      ...current,
      [active]: current[active].slice(0, start) + token + current[active].slice(end),
    }))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div ref={container} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-subject`}>Asunto</Label>
          <Input
            id={`${id}-subject`}
            name="subject"
            required
            minLength={2}
            maxLength={160}
            placeholder="Una idea para {{empresa}}"
            value={message.subject}
            ref={(el) => {
              refs.current.subject = el ?? undefined
            }}
            onFocus={() => setActive('subject')}
            onChange={(e) => setMessage({ ...message, subject: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-preview`}>
            Texto de vista previa{' '}
            <span className="font-normal text-muted-foreground">· opcional</span>
          </Label>
          <Input
            id={`${id}-preview`}
            name="previewText"
            maxLength={220}
            placeholder="La primera frase que verán en su bandeja"
            value={message.previewText}
            ref={(el) => {
              refs.current.previewText = el ?? undefined
            }}
            onFocus={() => setActive('previewText')}
            onChange={(e) => setMessage({ ...message, previewText: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-body`}>Mensaje</Label>
          <Textarea
            id={`${id}-body`}
            name="bodyMarkdown"
            required
            minLength={3}
            maxLength={30000}
            className="min-h-52"
            placeholder={'Hola {{nombre}},\n\nQuería compartir contigo…'}
            value={message.bodyMarkdown}
            ref={(el) => {
              refs.current.bodyMarkdown = el ?? undefined
            }}
            onFocus={() => setActive('bodyMarkdown')}
            onChange={(e) => setMessage({ ...message, bodyMarkdown: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Admite Markdown: **negrita** y [texto](https://ejemplo.com). La baja se añade
            automáticamente.
          </p>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="size-3.5" /> Personalizar el campo seleccionado
          </p>
          <div className="flex flex-wrap gap-2">
            {MARKETING_VARIABLES.map(({ key, label }) => (
              <Button
                type="button"
                key={key}
                size="sm"
                variant="outline"
                onClick={() => insert(key)}
              >
                + {label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Si falta el nombre o la empresa, se dejan vacíos.
          </p>
        </div>
      </div>
      <aside className="rounded-xl border bg-muted/30 p-4" aria-label="Vista previa de ejemplo">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Eye className="size-4" /> Vista previa de ejemplo
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Con datos ficticios. El formato Markdown se aplicará al enviar.
        </p>
        <div className="mt-4 rounded-lg border bg-background p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Asunto</p>
          <p className="mt-1 font-semibold break-words">
            {personalizeMarketingText(message.subject, SAMPLE) || 'Tu asunto aparecerá aquí'}
          </p>
          {message.previewText && (
            <p className="mt-1 text-xs break-words text-muted-foreground">
              {personalizeMarketingText(message.previewText, SAMPLE)}
            </p>
          )}
          <div className="mt-4 border-t pt-4 text-sm break-words whitespace-pre-wrap">
            {personalizeMarketingText(message.bodyMarkdown, SAMPLE) ||
              'Escribe tu mensaje para previsualizarlo.'}
          </div>
          <p className="mt-6 border-t pt-3 text-xs text-muted-foreground">
            El enlace de baja se añadirá al envío.
          </p>
        </div>
      </aside>
    </div>
  )
}
