'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { CalendarDays, CornerUpLeft, Eye, Mail, Sparkles, Video } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { MemberLabel } from '@/components/ui/member-avatar'
import { interactionBodyText } from '@/lib/leads/interaction-utils'
import { extractNextSteps, leadDidNotShow, parseMeetingInfo } from '@/lib/leads/meeting-info'
import type { LeadDetailInteraction } from '@/lib/leads/types'

import { EmailComposer } from './email-composer'
import { MeetingNextSteps, MeetingNoShowAlert } from './meeting-insights'
import { MeetingTranscriptViewer } from './meeting-transcript-viewer'

function payloadText(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const value = (payload as Record<string, unknown>)[key]
  if (typeof value === 'string') return value.trim() || null
  if (Array.isArray(value)) {
    const items = value.filter((item): item is string => typeof item === 'string' && Boolean(item))
    return items.length ? items.join(', ') : null
  }
  return null
}

function emailMetadata(payload: unknown): Array<[string, string]> {
  const metadata: Array<[string, string]> = []
  const fields = [
    ['De', 'from'],
    ['Para', 'to'],
    ['CC', 'cc'],
    ['Contacto', 'counterparty'],
  ] as const

  for (const [label, key] of fields) {
    const value = payloadText(payload, key)
    if (value) metadata.push([label, value])
  }
  return metadata
}

function emailAddress(value: string | null): string | null {
  if (!value) return null
  return (
    value.match(/<([^<>\s]+@[^<>\s]+)>/)?.[1] ??
    value.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0] ??
    null
  )
}

function replySubject(subject: string | null): string {
  if (!subject) return 'Re: '
  return /^(re|aw|sv):/i.test(subject.trim()) ? subject : `Re: ${subject}`
}

export function LeadInteractionDetails({
  interaction,
  label,
  leadId,
  leadEmail,
  leadLanguage,
  canReply = false,
  aiEnabled = false,
}: {
  interaction: LeadDetailInteraction
  label: string
  leadId: string
  leadEmail: string | null
  leadLanguage?: string | null
  canReply?: boolean
  aiEnabled?: boolean
}) {
  const [replying, setReplying] = useState(false)
  const router = useRouter()
  const body = interactionBodyText(interaction.body)
  const isEmail = interaction.type.startsWith('email_')
  const metadata = isEmail ? emailMetadata(interaction.payload) : []
  const meetingData =
    interaction.type === 'meeting' && interaction.payload && typeof interaction.payload === 'object'
      ? (interaction.payload as Record<string, unknown>)
      : null
  const meetingArtifactsValue = meetingData?.meet_artifacts
  const meetingDetails =
    meetingArtifactsValue && typeof meetingArtifactsValue === 'object'
      ? (meetingArtifactsValue as Record<string, unknown>)
      : null
  const meetUrl = typeof meetingData?.meet_url === 'string' ? meetingData.meet_url : null
  const meetingSummary =
    typeof meetingDetails?.summary === 'string' ? meetingDetails.summary.trim() : null
  const meetingNotes =
    typeof meetingDetails?.notes_text === 'string' ? meetingDetails.notes_text.trim() : null
  const transcript =
    typeof meetingDetails?.transcript_text === 'string'
      ? meetingDetails.transcript_text.trim()
      : null
  const transcriptUrl =
    typeof meetingDetails?.transcript_url === 'string' ? meetingDetails.transcript_url : null
  const notesUrl = typeof meetingDetails?.notes_url === 'string' ? meetingDetails.notes_url : null
  const importedAt =
    typeof meetingDetails?.processed_at === 'string' ? meetingDetails.processed_at : null
  const lastCheckedAt =
    typeof meetingDetails?.last_checked_at === 'string' ? meetingDetails.last_checked_at : null
  const meetingStart = typeof meetingData?.start === 'string' ? meetingData.start : null
  const actualStart =
    typeof meetingDetails?.actual_start === 'string' ? meetingDetails.actual_start : null
  const actualEnd =
    typeof meetingDetails?.actual_end === 'string' ? meetingDetails.actual_end : null
  const actualDuration =
    typeof meetingDetails?.duration_minutes === 'number' ? meetingDetails.duration_minutes : null
  const meetingParticipants = Array.isArray(meetingDetails?.participants)
    ? (meetingDetails.participants as Array<{
        name?: string
        email?: string | null
        start?: string | null
        end?: string | null
      }>)
    : []
  const meetingStarted = meetingStart ? new Date(meetingStart).getTime() <= Date.now() : false
  const meetingAttendees = Array.isArray(meetingData?.attendees)
    ? meetingData.attendees.filter((value): value is string => typeof value === 'string')
    : []
  const organizerEmail =
    typeof meetingData?.organizer_email === 'string' ? meetingData.organizer_email : null
  const showMeetingSection =
    interaction.type === 'meeting' &&
    Boolean(meetUrl || meetingSummary || meetingNotes || transcript || notesUrl || transcriptUrl)
  const meetingInfo = parseMeetingInfo(meetingData)
  const noShow = leadDidNotShow(meetingInfo, leadEmail)
  const nextSteps = extractNextSteps(meetingSummary ?? meetingNotes)
  const meetingDisplayStart = actualStart ?? meetingStart
  const meetingDate = meetingDisplayStart
    ? new Date(meetingDisplayStart).toLocaleString('es-ES')
    : null
  const replyTo =
    emailAddress(payloadText(interaction.payload, 'from')) ??
    emailAddress(payloadText(interaction.payload, 'counterparty')) ??
    leadEmail
  const canQuickReply = interaction.type === 'email_received' && canReply

  if (!body && !showMeetingSection) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
        >
          <Eye className="size-3" />
          Ver detalles
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-br from-primary/[0.07] via-background to-background p-5 pr-12 sm:p-6 sm:pr-14">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              {isEmail ? (
                <Mail className="size-5" />
              ) : interaction.type === 'meeting' ? (
                <Video className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </span>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{label}</Badge>
                {canQuickReply ? <Badge variant="neutral">Respuesta disponible</Badge> : null}
              </div>
              <DialogTitle className="text-left text-lg leading-snug sm:text-xl">
                {interaction.subject ?? label}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-left">
                <CalendarDays className="size-3.5" />
                <span>
                  {meetingDate ?? new Date(interaction.created_at).toLocaleString('es-ES')}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0 space-y-5">
              {replying ? (
                <section className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <CornerUpLeft className="size-4 text-primary" />
                        Respuesta rápida
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        La IA usará el mensaje completo como fuente prioritaria. Revisa siempre el
                        borrador.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplying(false)}
                    >
                      Cerrar
                    </Button>
                  </div>
                  <EmailComposer
                    defaultLanguage={leadLanguage ?? undefined}
                    key={interaction.id}
                    leadId={leadId}
                    defaultTo={replyTo ?? ''}
                    defaultSubject={replySubject(interaction.subject)}
                    draftKind="reply"
                    draftInteractionId={interaction.id}
                    draftInstructions="Responde directamente al mensaje recibido, cubre sus preguntas y mantén un tono claro, cercano y útil."
                    disabled={!replyTo}
                    disabledReason="No se ha podido identificar una dirección de respuesta."
                    aiEnabled={aiEnabled}
                    onSuccess={() => router.refresh()}
                  />
                </section>
              ) : null}

              {body ? (
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                    <div>
                      <h3 className="text-sm font-medium">
                        {interaction.type === 'meeting'
                          ? 'Descripción de la reunión'
                          : 'Contenido completo'}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {interaction.type === 'meeting'
                          ? 'Agenda y contexto guardados al agendar.'
                          : 'Formato original convertido a texto legible.'}
                      </p>
                    </div>
                    <CopyButton
                      text={body}
                      label="Copiar contenido"
                      showLabel
                      className="shrink-0"
                    />
                  </div>
                  <p className="p-4 text-sm leading-7 break-words whitespace-pre-wrap sm:p-5">
                    {body}
                  </p>
                </section>
              ) : null}
              {showMeetingSection ? (
                <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Video className="size-4" aria-hidden />
                      </span>
                      <div>
                        <h3 className="text-sm font-medium">Resumen de la reunión</h3>
                        <p className="text-xs text-muted-foreground">
                          {importedAt
                            ? `Sincronizado el ${new Date(importedAt).toLocaleString('es-ES')}`
                            : meetingStarted
                              ? lastCheckedAt
                                ? `Esperando los documentos de Google Meet · última búsqueda ${new Date(lastCheckedAt).toLocaleString('es-ES')}`
                                : 'Meet ha terminado; el backoffice espera a que Google genere los documentos.'
                              : 'Al terminar la reunión, el backoffice buscará aquí los documentos de Google Meet.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {meetUrl ? (
                        <Button asChild type="button" variant="outline" size="sm">
                          <a href={meetUrl} target="_blank" rel="noopener noreferrer">
                            Abrir Meet
                          </a>
                        </Button>
                      ) : null}
                      {notesUrl ? (
                        <Button asChild type="button" variant="outline" size="sm">
                          <a href={notesUrl} target="_blank" rel="noopener noreferrer">
                            Documento de notas
                          </a>
                        </Button>
                      ) : null}
                      {transcriptUrl ? (
                        <Button asChild type="button" variant="outline" size="sm">
                          <a href={transcriptUrl} target="_blank" rel="noopener noreferrer">
                            Documento de transcripción
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-4 p-4 sm:p-5">
                    {importedAt ? (
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg border bg-background/70 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Duración real</p>
                          <p className="mt-1 text-sm font-semibold">
                            {actualDuration !== null ? `${actualDuration} min` : 'No disponible'}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-background/70 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Participantes</p>
                          <p className="mt-1 text-sm font-semibold">{meetingParticipants.length}</p>
                        </div>
                        <div className="rounded-lg border bg-background/70 px-3 py-2">
                          <p className="text-xs text-muted-foreground">Estado</p>
                          <p className="mt-1 text-sm font-semibold">Información sincronizada</p>
                        </div>
                      </div>
                    ) : null}
                    {meetingParticipants.length ? (
                      <div>
                        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Quién estuvo en la llamada
                        </h4>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {meetingParticipants.map((participant) => (
                            <Badge
                              key={`${participant.email ?? participant.name ?? 'participante'}-${participant.start ?? ''}`}
                              variant="secondary"
                            >
                              {participant.name ?? participant.email ?? 'Participante'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {noShow ? <MeetingNoShowAlert leadId={leadId} /> : null}
                    {meetingSummary ? (
                      <div>
                        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Resumen de la reunión
                        </h4>
                        <p className="mt-2 text-sm leading-7 break-words whitespace-pre-wrap">
                          {meetingSummary}
                        </p>
                      </div>
                    ) : null}
                    {nextSteps.length > 0 && canReply ? (
                      <MeetingNextSteps leadId={leadId} steps={nextSteps} />
                    ) : null}
                    {meetingNotes && meetingNotes !== meetingSummary ? (
                      <details className="rounded-lg border border-border/70">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                          Notas completas de Google Meet
                        </summary>
                        <pre className="max-h-[50vh] overflow-auto border-t p-3 text-sm leading-6 whitespace-pre-wrap">
                          {meetingNotes}
                        </pre>
                      </details>
                    ) : null}
                    {transcript ? (
                      <details className="rounded-lg border border-border/70">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                          Ver transcripción íntegra
                        </summary>
                        <div className="border-t p-2">
                          <MeetingTranscriptViewer transcript={transcript} />
                        </div>
                      </details>
                    ) : importedAt ? (
                      <p className="text-sm text-muted-foreground">
                        Google no generó una transcripción para esta reunión.
                      </p>
                    ) : null}
                    {!importedAt && !meetingSummary && !meetingNotes && !transcript ? (
                      <p className="text-sm text-muted-foreground">
                        No hace falta reenviar ni copiar el email de Google: los documentos se
                        asociarán a esta ficha cuando estén listos.
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-0">
              <section className="rounded-xl border bg-muted/15 p-4">
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Detalles
                </h3>
                <dl className="mt-3 space-y-3 text-sm">
                  {metadata.map(([name, value]) => (
                    <div key={name}>
                      <dt className="text-xs text-muted-foreground">{name}</dt>
                      <dd className="mt-0.5 leading-snug font-medium break-words">{value}</dd>
                    </div>
                  ))}
                  {organizerEmail ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Organizador</dt>
                      <dd className="mt-0.5 leading-snug font-medium break-words">
                        {organizerEmail}
                      </dd>
                    </div>
                  ) : null}
                  {meetingAttendees.length > 0 ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Invitados</dt>
                      <dd className="mt-0.5 leading-snug font-medium break-words">
                        {meetingAttendees.join(', ')}
                      </dd>
                    </div>
                  ) : null}
                  {actualEnd ? (
                    <div>
                      <dt className="text-xs text-muted-foreground">Fin real</dt>
                      <dd className="mt-0.5 leading-snug font-medium break-words">
                        {new Date(actualEnd).toLocaleString('es-ES')}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs text-muted-foreground">Registrado por</dt>
                    <dd className="mt-1">
                      {interaction.performer ? (
                        <MemberLabel member={interaction.performer} size="xs" />
                      ) : (
                        <span className="font-medium">Sincronización automática</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              {canQuickReply ? (
                <section className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                  <Sparkles className="size-5 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold">Preparar respuesta</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Responde manualmente o genera un borrador contextual con IA usando todo el
                    email.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 w-full gap-2"
                    onClick={() => setReplying((value) => !value)}
                  >
                    <CornerUpLeft className="size-4" />
                    {replying ? 'Ocultar respuesta' : 'Responder'}
                  </Button>
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
