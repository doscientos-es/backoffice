'use client'

import { ArrowUpRight, ChevronDown, FileText, Info, Mail, Sparkles } from 'lucide-react'
import { useId } from 'react'

import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import { Textarea } from '@/components/ui/textarea'
import type { AssistantResponse } from '@/lib/leads/assistant-contract'
import { formatDate } from '@/lib/utils'

export function LeadAssistantMessage({
  result,
  onDraftChange,
}: {
  result: AssistantResponse
  onDraftChange: (draft: NonNullable<AssistantResponse['draft']>) => void
}) {
  const title = result.draft?.title ?? ''
  const body = result.draft?.body ?? ''
  const titleId = useId()
  const bodyId = useId()

  return (
    <article aria-label="Respuesta del asistente" className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent/40 text-accent-foreground">
            <Sparkles className="size-3.5" aria-hidden />
          </span>
          <span className="text-sm font-medium">Asistente</span>
        </div>
        <CopyButton text={result.answer} label="Copiar respuesta" className="size-9" />
      </div>
      <Markdown
        source={result.answer}
        className="gap-3 wrap-break-word [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm"
      />
      {result.sources.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground">Fuentes consultadas</p>
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Fuentes de la respuesta">
            {result.sources.map((source, index) => (
              <li key={source.id} className="min-w-0">
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={source.label}
                  className="flex h-full min-h-14 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-2.5 hover:border-primary/30 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block text-xs leading-5 font-medium wrap-break-word text-foreground">
                      {source.label}
                    </span>
                    {source.createdAt ? (
                      <time
                        dateTime={source.createdAt}
                        className="block text-xs text-muted-foreground"
                      >
                        {formatDate(source.createdAt)}
                      </time>
                    ) : null}
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Sin fuentes enlazadas. Contrasta esta respuesta antes de usarla.
        </p>
      )}
      <details className="group text-xs text-muted-foreground">
        <summary className="flex min-h-9 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <Info className="size-3.5 shrink-0" aria-hidden />
          Contexto parcial · ver alcance
          <ChevronDown className="size-3.5 group-open:rotate-180" aria-hidden />
        </summary>
        <p className="mt-1 border-l-2 border-border pl-3 leading-relaxed">{result.coverage}</p>
      </details>
      {result.draft ? (
        <section
          className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs"
          aria-label="Borrador editable"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              {result.draft.kind === 'email' ? (
                <Mail className="size-4 text-primary" aria-hidden />
              ) : (
                <FileText className="size-4 text-primary" aria-hidden />
              )}
              <p className="text-sm font-medium">
                Borrador de {result.draft.kind === 'email' ? 'email' : 'propuesta'}
              </p>
            </div>
            <CopyButton
              text={`${title}\n\n${body}`}
              label="Copiar borrador"
              showLabel
              className="min-h-9 border border-border bg-card px-3 text-foreground"
            />
          </div>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <label htmlFor={titleId} className="text-xs font-medium text-muted-foreground">
                {result.draft.kind === 'email' ? 'Asunto' : 'Título'}
              </label>
              <Input
                id={titleId}
                aria-label="Título del borrador"
                value={title}
                onChange={(event) =>
                  result.draft && onDraftChange({ ...result.draft, title: event.target.value })
                }
                maxLength={200}
                className="min-h-11 bg-background text-base font-medium sm:text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={bodyId} className="text-xs font-medium text-muted-foreground">
                {result.draft.kind === 'email' ? 'Mensaje' : 'Contenido'}
              </label>
              <Textarea
                id={bodyId}
                aria-label="Texto del borrador"
                value={body}
                onChange={(event) =>
                  result.draft && onDraftChange({ ...result.draft, body: event.target.value })
                }
                rows={8}
                maxLength={6000}
                className="min-h-48 bg-background text-base leading-relaxed sm:text-sm"
              />
            </div>
            <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Puedes editarlo y copiarlo. No se ha enviado ni creado ningún registro.
            </p>
          </div>
        </section>
      ) : null}
    </article>
  )
}
