'use client'

// Compartido entre el drawer de la lista de leads y la ficha del lead.
// Acciones rápidas de comunicación, nota y agenda
// con opción de agendar follow-up. Todas refrescan el router tras éxito.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { Mail, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type SubmitEvent, useEffect, useId, useState } from 'react'

import { GoogleMeetIcon } from '@/components/icons/google-meet-icon'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EntityCombobox } from '@/components/ui/entity-combobox'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_MEETING_DURATION,
  defaultMeetingStart,
  MEETING_DURATIONS,
  type MeetingDuration,
} from '@/lib/calendar/date-presets'
import { addMinutesToDatetimeLocal, datetimeLocalToIso } from '@/lib/utils/date-time'

import { EmailComposer } from './[id]/email-composer'
import { logLeadEmail, logLeadNote, scheduleLeadMeeting } from './actions'
import { type MeetMember, MemberCheckboxes, useMemberToggle } from './meet-member-picker'
import { QuickActionTile } from './quick-action-tile'
import { WhatsAppComposer } from './whatsapp-composer'

export { QCallDialog } from './call-dialog'

// ─── QMeetDialog ──────────────────────────────────────────────────────────────

export type { MeetMember }

export { QuickActionTile }

// ─── QMeetDialog — scheduled meeting ─────────────────────────────────────────

export function QMeetDialog({
  leadId,
  leadName,
  leadEmail,
  projects,
  meetMembers = [],
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  projects: Array<{ id: string; name: string }>
  meetMembers?: MeetMember[]
}) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [title, setTitle] = useState(`Consultoría ${leadName} - Doscientos`)
  const [start, setStart] = useState(defaultMeetingStart)
  const [duration, setDuration] = useState<MeetingDuration>(DEFAULT_MEETING_DURATION)
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const members = useMemberToggle()
  const feedback = useFormFeedback()
  const router = useRouter()
  const dialogId = useId()

  useEffect(() => {
    if (!open) return
    setTitle(`Consultoría ${leadName} - Doscientos`)
    setStart(defaultMeetingStart())
    setDuration(DEFAULT_MEETING_DURATION)
    setDescription('')
    setProjectId('')
    members.reset()
  }, [open, leadName, members.reset])

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setConfirmOpen(true)
  }

  async function handleConfirmSchedule() {
    feedback.setPending()
    const attendeeEmails = [...(leadEmail ? [leadEmail] : []), ...members.emails(meetMembers)]
    const res = await scheduleLeadMeeting({
      leadId,
      title,
      description: description.trim() || undefined,
      start: datetimeLocalToIso(start),
      end: datetimeLocalToIso(addMinutesToDatetimeLocal(start, duration)),
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      projectId: projectId || undefined,
      withMeet: true,
    })
    if (!res.ok) {
      setConfirmOpen(false)
      return feedback.setError(res.error)
    }
    setConfirmOpen(false)
    feedback.setSuccess('Reunión creada')
    router.refresh()
    setTimeout(() => setOpen(false), 600)
  }

  const selectedInternalMembers = meetMembers
    .filter((member) => members.selected.has(member.id))
    .map((member) => member.name)

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <QuickActionTile
            icon={<GoogleMeetIcon className="h-3.5 w-auto shrink-0" />}
            label="Agendar"
          />
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agendar reunión Google Meet</DialogTitle>
            <DialogDescription>
              {leadEmail
                ? `Se creará en el calendario compartido y se enviará una invitación a ${leadEmail}.`
                : 'Se creará en el calendario compartido. Este lead no tiene email registrado.'}{' '}
              La reunión quedará vinculada a esta ficha; el backoffice añadirá las notas de Gemini y
              la transcripción cuando Google las genere, aunque el correo llegue a otro organizador.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-meet-title-${leadId}`} className="text-xs font-medium">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`qa-meet-title-${leadId}`}
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-start-${leadId}`} className="text-xs font-medium">
                  Inicio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`qa-meet-start-${leadId}`}
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-duration-${leadId}`} className="text-xs font-medium">
                  Duración <span className="text-destructive">*</span>
                </Label>
                <Select
                  id={`qa-meet-duration-${leadId}`}
                  required
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) as MeetingDuration)}
                >
                  {MEETING_DURATIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutos
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {projects.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`qa-meet-project-${leadId}`} className="text-xs font-medium">
                  Proyecto <span className="text-muted-foreground/60">(opcional)</span>
                </Label>
                <EntityCombobox
                  id={`qa-meet-project-${leadId}`}
                  items={projects.map((p) => ({ id: p.id, label: p.name }))}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="Buscar proyecto…"
                />
              </div>
            )}
            <MemberCheckboxes
              idPrefix={`${dialogId}-scheduled-meet-${leadId}`}
              members={meetMembers}
              selected={members.selected}
              onToggle={members.toggle}
            />
            <div className="rounded-md border border-primary/15 bg-primary/[0.04] px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              La ficha guardará el enlace de Meet y buscará las notas y la transcripción al terminar
              la reunión. La llegada del documento por email no es necesaria.
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-meet-desc-${leadId}`} className="text-xs font-medium">
                Descripción <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-meet-desc-${leadId}`}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, puntos a tratar…"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Creando…" />
              <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
                Agendar reunión
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={leadEmail ? '¿Enviar invitación de reunión?' : '¿Crear reunión sin invitar al lead?'}
        description={
          <>
            {leadEmail ? (
              <p>
                Se enviará una invitación real de Google Calendar a <strong>{leadEmail}</strong>.
              </p>
            ) : (
              <p>Este lead no tiene email registrado y no recibirá una invitación.</p>
            )}
            <p className="mt-2">
              <strong>{title}</strong> · {start.replace('T', ' ')}.
            </p>
            <p className="mt-2">
              {leadEmail
                ? 'El lead recibirá la invitación en su calendario.'
                : 'La reunión se creará sin invitación para el lead.'}
            </p>
            {selectedInternalMembers.length > 0 ? (
              <p className="mt-2">
                En el calendario compartido: <strong>{selectedInternalMembers.join(', ')}</strong>.
                No recibirán un correo duplicado.
              </p>
            ) : null}
            <p className="mt-2">
              Al terminar, Meet generará los documentos según la configuración de Google Workspace;
              el backoffice los vinculará aquí automáticamente.
            </p>
          </>
        }
        confirmLabel={leadEmail ? 'Sí, enviar invitación' : 'Sí, crear reunión'}
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmSchedule()}
      />
    </>
  )
}

// ─── QMeetNowDialog — instant Meet ───────────────────────────────────────────

export function QMeetNowDialog({
  leadId,
  leadName,
  leadEmail,
  meetMembers = [],
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  meetMembers?: MeetMember[]
}) {
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [description, setDescription] = useState('')
  const members = useMemberToggle()
  const feedback = useFormFeedback()
  const router = useRouter()
  const dialogId = useId()

  useEffect(() => {
    if (!open) return
    setDescription('')
    members.reset()
  }, [open, members.reset])

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setConfirmOpen(true)
  }

  async function handleConfirmCreate() {
    feedback.setPending()
    const meetWindow = window.open('about:blank', '_blank')
    const now = new Date()
    const endTime = new Date(now.getTime() + 60 * 60 * 1000)
    const attendeeEmails = [...(leadEmail ? [leadEmail] : []), ...members.emails(meetMembers)]
    const res = await scheduleLeadMeeting({
      leadId,
      title: `Consultoría ${leadName} - Doscientos`,
      description: description.trim() || undefined,
      start: now.toISOString(),
      end: endTime.toISOString(),
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
      withMeet: true,
    })
    if (!res.ok) {
      meetWindow?.close()
      setConfirmOpen(false)
      return feedback.setError(res.error)
    }
    setConfirmOpen(false)
    feedback.setSuccess(
      meetWindow && res.meetUrl
        ? '¡Meet creado!'
        : 'Meet creado; puedes abrir el enlace desde la actividad del lead.',
    )
    router.refresh()
    if (res.meetUrl && meetWindow) {
      meetWindow.opener = null
      meetWindow.location.href = res.meetUrl
    } else {
      meetWindow?.close()
    }
    setTimeout(() => setOpen(false), 600)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <QuickActionTile
            icon={<GoogleMeetIcon className="h-3.5 w-auto shrink-0" />}
            label="Ahora"
          />
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar Meet ahora</DialogTitle>
            <DialogDescription>
              {leadEmail
                ? `Se crea el enlace Meet, se abre en una nueva pestaña y se invita a ${leadEmail}.`
                : 'Se crea el enlace Meet y se abre en una nueva pestaña. Este lead no tiene email registrado.'}{' '}
              Las notas y la transcripción se añadirán automáticamente a esta ficha cuando Meet las
              genere.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <MemberCheckboxes
              idPrefix={`${dialogId}-instant-meet-${leadId}`}
              members={meetMembers}
              selected={members.selected}
              onToggle={members.toggle}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-now-desc-${leadId}`} className="text-xs font-medium">
                Notas <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <Textarea
                id={`qa-now-desc-${leadId}`}
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Agenda, puntos a tratar…"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <FormFeedback state={feedback.state} pendingLabel="Creando…" />
              <SubmitButton loading={feedback.pending} pendingLabel="Creando…">
                Crear y unirse
              </SubmitButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={leadEmail ? '¿Enviar invitación y abrir Meet?' : '¿Crear Meet sin invitar al lead?'}
        description={
          <>
            {leadEmail ? (
              <p>
                Se enviará una invitación real de Google Calendar a <strong>{leadEmail}</strong>.
              </p>
            ) : (
              <p>Este lead no tiene email registrado y no recibirá una invitación.</p>
            )}
            <p className="mt-2">También se abrirá el enlace de Meet en una nueva pestaña.</p>
            <p className="mt-2">
              Al terminar la llamada, el backoffice buscará las notas de Gemini y la transcripción
              generadas por Google Meet y las guardará en esta ficha.
            </p>
          </>
        }
        confirmLabel={leadEmail ? 'Sí, crear y enviar' : 'Sí, crear y abrir Meet'}
        cancelLabel="Volver a revisar"
        pending={feedback.pending}
        onConfirm={() => void handleConfirmCreate()}
      />
    </>
  )
}

export function QWhatsAppDialog({
  leadId,
  leadName,
  leadAlias,
  leadCompany,
  leadEmail,
  leadPhone,
  leadLanguage,
  senderName,
  aiEnabled,
}: {
  leadId: string
  leadName: string
  leadAlias?: string | null
  leadCompany?: string | null
  leadEmail: string | null
  leadPhone: string | null
  leadLanguage?: string | null
  senderName: string
  aiEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <QuickActionTile
          icon={<WhatsAppIcon className="size-3.5 text-success" />}
          label="Preparar"
          tone="whatsapp"
        />
      </DialogTrigger>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onOverlayClick={(event) => {
          // Este diálogo se abre dentro del drawer del panel rápido. Evitamos
          // que el clic exterior cierre ambas capas y cerramos solo el diálogo.
          event.stopPropagation()
          setOpen(false)
        }}
      >
        <DialogHeader>
          <DialogTitle>Preparar WhatsApp</DialogTitle>
          <DialogDescription>
            Revisa el texto, envíalo en WhatsApp y confirma después para registrarlo.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppComposer
          leadId={leadId}
          leadName={leadName}
          leadAlias={leadAlias}
          leadCompany={leadCompany}
          leadEmail={leadEmail}
          leadPhone={leadPhone}
          defaultLanguage={leadLanguage ?? undefined}
          senderName={senderName}
          aiEnabled={aiEnabled}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function QEmailDialog({ leadId, leadEmail }: { leadId: string; leadEmail: string | null }) {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('outgoing')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadEmail({
      leadId,
      direction,
      subject,
      bodyHtml: body.trim() || undefined,
      counterparty: leadEmail ?? undefined,
    })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Registrado')
    setSubject('')
    setBody('')
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <QuickActionTile
          icon={<Mail className="size-3.5 text-muted-foreground" />}
          label="Registrar"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar email</DialogTitle>
          <DialogDescription>Para emails enviados o recibidos fuera de la app.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-dir-${leadId}`} className="text-xs font-medium">
              Dirección
            </Label>
            <Select
              id={`qa-email-dir-${leadId}`}
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'incoming' | 'outgoing')}
            >
              <option value="outgoing">Enviado</option>
              <option value="incoming">Recibido</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-subj-${leadId}`} className="text-xs font-medium">
              Asunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`qa-email-subj-${leadId}`}
              required
              maxLength={300}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del email"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`qa-email-body-${leadId}`} className="text-xs font-medium">
              Cuerpo{' '}
              <span className="text-muted-foreground/60">(opcional, mejora el resumen IA)</span>
            </Label>
            <Textarea
              id={`qa-email-body-${leadId}`}
              rows={5}
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Pega o resume el contenido del email…"
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Registrar</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QNoteDialog({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const feedback = useFormFeedback()
  const router = useRouter()

  async function onSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    feedback.setPending()
    const res = await logLeadNote({ leadId, content })
    if (!res.ok) return feedback.setError(res.error)
    feedback.setSuccess('Nota guardada')
    setContent('')
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <QuickActionTile icon={<Plus className="size-3.5 text-muted-foreground" />} label="Nota" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Añadir nota</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Textarea
            rows={4}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Observaciones, contexto, próximos pasos…"
          />
          <div className="flex items-center justify-end gap-3">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending}>Guardar nota</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function QSendEmailDialog({
  leadId,
  leadEmail,
  defaultLanguage,
  aiEnabled,
}: {
  leadId: string
  leadEmail: string | null
  defaultLanguage?: string | null
  aiEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSuccess() {
    router.refresh()
    setTimeout(() => setOpen(false), 400)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <QuickActionTile
          icon={<Mail className="size-3.5 text-muted-foreground" />}
          label="Enviar"
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar email</DialogTitle>
          {leadEmail && <DialogDescription>{leadEmail}</DialogDescription>}
        </DialogHeader>
        <EmailComposer
          leadId={leadId}
          defaultTo={leadEmail ?? ''}
          defaultLanguage={defaultLanguage ?? undefined}
          disabled={!leadEmail}
          disabledReason="Este lead no tiene email registrado."
          aiEnabled={aiEnabled}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  )
}
