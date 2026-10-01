'use client'

import { CircleCheck as CheckCircle2, Copy, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { cancelDeliveryNote, createDeliveryNote } from '../delivery-actions'

export type DeliveryNote = {
  id: string
  version: number
  status: string
  portal_token: string
  sent_at: string | null
  first_viewed_at: string | null
  accepted_at: string | null
  accepted_by_name: string | null
  accepted_by_role: string | null
  document_hash: string | null
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Delivery note (albarán) of an accepted proposal: issue it, share the
 * signing link and show the client's signature once received.
 */
export function DeliveryNoteCard({
  proposalId,
  note,
  hasMaintenance,
  canEdit,
}: {
  proposalId: string
  note: DeliveryNote | null
  hasMaintenance: boolean
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const path = note ? `/p/delivery/${note.portal_token}` : null

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  async function handleCopy() {
    if (!path) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`)
      sileo.success({ title: 'Enlace copiado' })
    } catch {
      sileo.error({ title: 'No se pudo copiar el enlace' })
    }
  }

  const signed = note?.status === 'accepted'
  const pendingSignature = note?.status === 'sent' || note?.status === 'viewed'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Albarán de entrega</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {signed && note ? (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium">
                Firmado por {note.accepted_by_name}
                {note.accepted_by_role ? ` · ${note.accepted_by_role}` : ''}
              </p>
              {note.accepted_at ? (
                <p className="text-xs">{formatDateTime(note.accepted_at)}. Propuesta terminada.</p>
              ) : null}
              {note.document_hash ? (
                <p className="truncate font-mono text-[11px] opacity-80">{note.document_hash}</p>
              ) : null}
            </div>
          </div>
        ) : pendingSignature && path && note ? (
          <>
            <p className="text-muted-foreground">
              Pendiente de firma del cliente
              {note.first_viewed_at
                ? ` · visto el ${formatDateTime(note.first_viewed_at)}`
                : ' · sin abrir'}
              .
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {path}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleCopy}
                aria-label="Copiar enlace"
                title="Copiar enlace"
              >
                <Copy className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => window.open(path, '_blank', 'noopener,noreferrer')}
                aria-label="Abrir en pestaña nueva"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => createDeliveryNote({ id: proposalId }))}
                >
                  Regenerar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => cancelDeliveryNote({ id: note.id }))}
                >
                  Anular
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Cuando entregues el proyecto, genera el albarán para que el cliente firme la
              conformidad con lo acordado. Al firmarlo, la propuesta queda terminada
              {hasMaintenance ? ' y se activa la suscripción de mantenimiento' : ''}. El proyecto
              sigue abierto.
            </p>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={pending}
                onClick={() => run(() => createDeliveryNote({ id: proposalId }))}
              >
                {pending ? 'Generando…' : 'Generar albarán'}
              </Button>
            ) : null}
          </>
        )}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
