'use client'

import { Video } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { extractNextSteps, isNoShow, type MeetingInfo } from '@/lib/leads/meeting-info'

import { MeetingArtifactDetails } from './meeting-artifact-details'
import { MeetingNextSteps, MeetingNoShowAlert } from './meeting-insights'

const fmt = (iso: string) => new Date(iso).toLocaleString('es-ES')

function statusText(info: MeetingInfo): string {
  if (info.importedAt) return `Sincronizado el ${fmt(info.importedAt)}`
  const started = info.start ? new Date(info.start).getTime() <= Date.now() : false
  if (!started) return 'Al terminar la reunión, el backoffice buscará aquí los documentos de Meet.'
  return info.lastCheckedAt
    ? `Esperando los documentos de Google Meet · última búsqueda ${fmt(info.lastCheckedAt)}`
    : 'Meet ha terminado; el backoffice espera a que Google genere los documentos.'
}

function LinkButton({ href, children }: { href: string | null; children: string }) {
  if (!href) return null
  return (
    <Button asChild type="button" variant="outline" size="sm">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  )
}

/** Whether a meeting interaction has anything worth a dedicated section. */
export function hasMeetingContent(info: MeetingInfo): boolean {
  return Boolean(
    info.meetUrl ||
    info.summary ||
    info.hasNotes ||
    info.hasTranscript ||
    info.notesUrl ||
    info.transcriptUrl ||
    info.recordingUrl,
  )
}

/** Sidebar facts of a meeting: organizer, invitees and real end time. */
export function MeetingFacts({ info }: { info: MeetingInfo }) {
  const rows: Array<[string, string]> = []
  if (info.organizerEmail) rows.push(['Organizador', info.organizerEmail])
  if (info.attendees.length) rows.push(['Invitados', info.attendees.join(', ')])
  if (info.actualEnd) rows.push(['Fin real', fmt(info.actualEnd)])
  return rows.map(([name, value]) => (
    <div key={name}>
      <dt className="text-xs text-muted-foreground">{name}</dt>
      <dd className="mt-0.5 leading-snug font-medium break-words">{value}</dd>
    </div>
  ))
}

/** Everything Google Meet gave us for a meeting: status, who joined, summary, notes, transcript. */
export function MeetingDetailsSection({
  info,
  interactionId,
  leadId,
  leadEmail,
  canEdit,
}: {
  info: MeetingInfo
  interactionId: string
  leadId: string
  leadEmail: string | null
  canEdit: boolean
}) {
  const nextSteps = extractNextSteps(info.summary)
  const noArtifacts = !info.importedAt && !info.summary && !info.hasNotes && !info.hasTranscript

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Video className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-medium">Resumen de la reunión</h3>
            <p className="text-xs text-muted-foreground">{statusText(info)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton href={info.meetUrl}>Abrir Meet</LinkButton>
          <LinkButton href={info.recordingUrl}>Ver grabación</LinkButton>
          <LinkButton href={info.notesUrl}>Documento de notas</LinkButton>
          <LinkButton href={info.transcriptUrl}>Documento de transcripción</LinkButton>
        </div>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        {info.participants.length ? (
          <div>
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Quién estuvo en la llamada
              {info.durationMinutes !== null ? ` · ${info.durationMinutes} min` : ''}
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {info.participants.map((p) => (
                <Badge key={`${p.email ?? p.name}-${p.start}`} variant="secondary">
                  {p.name ?? p.email ?? 'Participante'}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {isNoShow(info, leadEmail) ? (
          <MeetingNoShowAlert leadId={leadId} interactionId={interactionId} canEdit={canEdit} />
        ) : null}
        {info.summary ? (
          <p className="text-sm leading-7 break-words whitespace-pre-wrap">{info.summary}</p>
        ) : null}
        {info.summaryTruncated ? (
          <p className="text-xs text-muted-foreground">
            El resumen puede ser parcial. Consulta los documentos de Google para ver todo el
            contenido.
          </p>
        ) : null}
        {nextSteps.length > 0 && (canEdit || info.automaticTaskIds !== null) ? (
          <MeetingNextSteps
            leadId={leadId}
            steps={nextSteps}
            automaticTaskIds={info.automaticTaskIds}
          />
        ) : null}
        {info.hasNotes ? (
          <MeetingArtifactDetails
            key={`${interactionId}-notes`}
            leadId={leadId}
            interactionId={interactionId}
            kind="notes"
            documentUrl={info.notesUrl}
          />
        ) : null}
        {info.hasTranscript ? (
          <MeetingArtifactDetails
            key={`${interactionId}-transcript`}
            leadId={leadId}
            interactionId={interactionId}
            kind="transcript"
            truncated={info.transcriptTruncated}
            documentUrl={info.transcriptUrl}
          />
        ) : info.importedAt ? (
          <p className="text-sm text-muted-foreground">
            {info.summaryOnly
              ? 'Guardamos solo las notas importantes y las tareas. Los documentos originales siguen en Google.'
              : info.transcriptUrl
                ? 'La transcripción está disponible en el documento de Google.'
                : 'Google no generó una transcripción para esta reunión.'}
          </p>
        ) : null}
        {noArtifacts ? (
          <p className="text-sm text-muted-foreground">
            No hace falta reenviar ni copiar el email de Google: los documentos se asociarán a esta
            ficha cuando estén listos.
          </p>
        ) : null}
      </div>
    </section>
  )
}
