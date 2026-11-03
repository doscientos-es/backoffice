'use client'

import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

import { loadMeetingArtifact } from './meeting-artifact-actions'
import { MeetingTranscriptViewer } from './meeting-transcript-viewer'

/** Fetch only the document being opened; retain it while this detail view is mounted. */
export function MeetingArtifactDetails({
  leadId,
  interactionId,
  kind,
  truncated = false,
  documentUrl,
}: {
  leadId: string
  interactionId: string
  kind: 'notes' | 'transcript'
  truncated?: boolean
  documentUrl: string | null
}) {
  const [artifact, setArtifact] = useState<{ text: string; truncated: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  async function load() {
    if (inFlight.current || artifact) return
    inFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await loadMeetingArtifact({ leadId, interactionId, kind })
      if (!result.ok) setError(result.error)
      else setArtifact({ text: result.text, truncated: result.truncated })
    } catch {
      setError('No se pudo cargar el documento. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
      inFlight.current = false
    }
  }

  return (
    <details
      className="rounded-lg border border-border/70"
      onToggle={(event) => {
        if (event.currentTarget.open && !error) void load()
      }}
    >
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
        {kind === 'notes' ? 'Notas completas de Google Meet' : 'Ver transcripción'}
      </summary>
      <div className="space-y-2 border-t p-3" aria-busy={loading}>
        {truncated || artifact?.truncated ? (
          <p className="text-xs text-muted-foreground">
            Transcripción recortada por tamaño.{' '}
            {documentUrl ? (
              <a className="underline" href={documentUrl} target="_blank" rel="noopener noreferrer">
                Ver documento completo en Google
              </a>
            ) : (
              'Consulta el documento original en Google Meet.'
            )}
          </p>
        ) : null}
        {loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando documento…
          </p>
        ) : null}
        {error ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : null}
        {artifact?.text ? (
          kind === 'transcript' ? (
            <MeetingTranscriptViewer transcript={artifact.text} />
          ) : (
            <pre className="max-h-[50vh] overflow-auto text-sm leading-6 whitespace-pre-wrap">
              {artifact.text}
            </pre>
          )
        ) : artifact ? (
          <p className="text-sm text-muted-foreground">
            El documento no contiene texto disponible.
          </p>
        ) : null}
      </div>
    </details>
  )
}
