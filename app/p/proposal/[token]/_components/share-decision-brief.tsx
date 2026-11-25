'use client'

import { Copy, Mail, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { makeTr, type PortalLanguage } from '../_lib/i18n'

export function ShareDecisionBrief({
  path,
  title,
  language,
}: {
  path: string
  title: string
  language: PortalLanguage
}) {
  const tr = makeTr(language)
  const [origin, setOrigin] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const url = `${origin}${path}`
  const subject = tr(
    `Resumen de propuesta: ${title}`,
    `Resum de proposta: ${title}`,
    `Proposal summary: ${title}`,
  )
  const body = tr(
    'Te comparto el resumen de la propuesta:',
    'Et comparteixo el resum de la proposta:',
    'Here is the proposal summary:',
  )
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setMessage(tr('Enlace copiado.', 'Enllaç copiat.', 'Link copied.'))
    } catch {
      setMessage(
        tr(
          'No se pudo copiar el enlace.',
          'No s’ha pogut copiar l’enllaç.',
          'Could not copy the link.',
        ),
      )
    }
  }
  const share = async () => {
    if (!navigator.share) return copy()
    try {
      await navigator.share({ title: subject, url })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(
        tr(
          'No se pudo compartir el enlace.',
          'No s’ha pogut compartir l’enllaç.',
          'Could not share the link.',
        ),
      )
    }
  }
  const action =
    'inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white'
  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={share} disabled={!origin} className={action}>
          <Share2 className="size-4" aria-hidden />
          {tr('Compartir', 'Compartir', 'Share')}
        </button>
        <button type="button" onClick={copy} disabled={!origin} className={action}>
          <Copy className="size-4" aria-hidden />
          {tr('Copiar enlace', 'Copiar enllaç', 'Copy link')}
        </button>
        {origin ? (
          <a
            className={action}
            href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\n${url}`)}`}
          >
            <Mail className="size-4" aria-hidden />
            {tr('Enviar por email', 'Enviar per correu', 'Send by email')}
          </a>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
        {tr(
          'El enlace da acceso a la propuesta; compártelo solo con quien corresponda.',
          'L’enllaç dona accés a la proposta; comparteix-lo només amb qui correspongui.',
          'The link gives access to the proposal; share it only with intended recipients.',
        )}
      </p>
      <p role="status" className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        {message}
      </p>
    </div>
  )
}
