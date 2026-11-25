'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@doscientos/ui'
import { useEffect, useState } from 'react'

import type { AttachmentItem } from './attachment-section'

export function AttachmentPreviewDialog({
  attachment,
  onClose,
}: {
  attachment: AttachmentItem | null
  onClose: () => void
}) {
  const [preview, setPreview] = useState<{
    id: string
    url?: string
    text?: string
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!attachment) return
    const controller = new AbortController()
    let url: string | undefined
    void (async () => {
      try {
        const response = await fetch(`/api/documents/${attachment.id}/view`, {
          signal: controller.signal,
        })
        if (
          !response.ok ||
          response.headers.get('content-type')?.split(';')[0] !== attachment.mime_type
        ) {
          throw new Error('No se pudo cargar la vista previa')
        }
        if (attachment.mime_type === 'text/plain') {
          const text = await response.text()
          if (!controller.signal.aborted) setPreview({ id: attachment.id, text })
          return
        }
        const blob = await response.blob()
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setPreview({ id: attachment.id, url })
      } catch {
        if (!controller.signal.aborted) {
          setPreview({ id: attachment.id, error: 'No se pudo cargar la vista previa.' })
        }
      }
    })()
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [attachment])

  const current = preview?.id === attachment?.id ? preview : null
  const source = attachment ? `/api/documents/${attachment.id}/view` : ''
  return (
    <Dialog open={attachment !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="break-words">{attachment?.name ?? 'Vista previa'}</DialogTitle>
          <DialogDescription>Vista previa del adjunto</DialogDescription>
        </DialogHeader>
        {!current ? <p role="status">Cargando vista previa…</p> : null}
        {current?.error ? <p role="alert">{current.error}</p> : null}
        {current?.text !== undefined && (
          <pre className="max-h-[65vh] overflow-auto rounded-md border p-3 text-sm break-words whitespace-pre-wrap">
            {current.text}
          </pre>
        )}
        {current?.url && attachment?.mime_type === 'application/pdf' ? (
          <iframe
            title={`Vista previa de ${attachment.name}`}
            src={current.url}
            sandbox="allow-scripts"
            className="h-[65vh] w-full rounded-md border"
          />
        ) : null}
        {current?.url && attachment?.mime_type?.startsWith('image/') ? (
          <div className="flex max-h-[65vh] justify-center overflow-auto rounded-md bg-muted/30 p-2">
            {/* biome-ignore lint/performance/noImgElement: previews use a temporary authenticated blob URL. */}
            <img
              src={current.url}
              alt={attachment.name}
              className="max-h-[60vh] max-w-full object-contain"
            />
          </div>
        ) : null}
        {attachment && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            Abrir en otra pestaña
          </a>
        )}
      </DialogContent>
    </Dialog>
  )
}
