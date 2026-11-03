'use client'

import { useState } from 'react'

import { CopyButton } from '@/components/ui/copy-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AssistantResponse } from '@/lib/leads/assistant-contract'
import { formatDate } from '@/lib/utils'

export function LeadAssistantMessage({ result }: { result: AssistantResponse }) {
  const [title, setTitle] = useState(result.draft?.title ?? '')
  const [body, setBody] = useState(result.draft?.body ?? '')

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
      {result.sources.length > 0 ? (
        <ul className="space-y-1 text-xs" aria-label="Fuentes de la respuesta">
          {result.sources.map((source) => (
            <li key={source.id}>
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                {source.label}
                {source.createdAt ? ` · ${formatDate(source.createdAt)}` : ''}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          La respuesta no aporta fuentes verificables.
        </p>
      )}
      <p className="text-xs text-muted-foreground">{result.coverage}</p>
      {result.draft ? (
        <section className="space-y-2 border-t pt-3" aria-label="Borrador editable">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Borrador de {result.draft.kind === 'email' ? 'email' : 'propuesta'}
            </p>
            <CopyButton text={`${title}\n\n${body}`} label="Copiar borrador" />
          </div>
          <Input
            aria-label="Título del borrador"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
          />
          <Textarea
            aria-label="Texto del borrador"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={6000}
          />
          <p className="text-xs text-muted-foreground">
            Revísalo antes de copiarlo. No se ha enviado ni creado ningún registro.
          </p>
        </section>
      ) : null}
    </div>
  )
}
