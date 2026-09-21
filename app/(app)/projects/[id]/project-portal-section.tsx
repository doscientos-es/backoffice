'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { LoaderCircle as Loader2, Mail, Rocket } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { CopyPortalLink } from '@/components/portal/copy-portal-link'
import { PortalAccessControls } from '@/components/portal/portal-access-controls'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buildProjectWhatsAppMessage, buildWhatsAppUrl } from '@/lib/leads/whatsapp'

import {
  previewProjectPortalEmail,
  publishProjectPortal,
  sendProjectPortalEmail,
  updateProjectPortalAccess,
} from '../actions'

type Props = {
  projectId: string
  projectName: string
  portalToken: string
  visible: boolean
  hasPassword: boolean
  inviteSentAt: string | null
  clientEmail: string | null
  clientPhone: string | null
  canEdit: boolean
  canPublish: boolean
}

export function ProjectPortalSection({
  projectId,
  projectName,
  portalToken,
  visible,
  hasPassword,
  inviteSentAt,
  clientEmail,
  clientPhone,
  canEdit,
  canPublish,
}: Props) {
  const router = useRouter()
  const feedback = useFormFeedback({ successResetMs: 5000 })
  const [publishing, setPublishing] = useState(false)

  const activate = async () => {
    feedback.setPending()
    setPublishing(true)
    const result = await publishProjectPortal({ id: projectId })
    setPublishing(false)
    if (!result.ok) {
      feedback.setError(result.error)
      return
    }
    feedback.setSuccess('Portal activado y email enviado')
    router.refresh()
  }

  return (
    <Card className={!visible ? 'border-primary/30 shadow-sm' : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Portal del cliente</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Comparte el seguimiento del proyecto y recibe solicitudes del cliente en un único lugar.
          </p>
        </div>
        {visible ? (
          <Badge variant="success">Activo para el cliente</Badge>
        ) : (
          <Badge>Sin activar</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!visible ? (
          <div className="border-primary/25 bg-primary/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full">
                <Rocket className="size-4" aria-hidden />
              </span>
              <div>
                <p className="font-medium">Activa el portal cuando empiece el proyecto</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  El cliente podrá ver el seguimiento y recibirá automáticamente el email de
                  arranque con su enlace privado.
                </p>
              </div>
            </div>
            {canPublish ? (
              <Button
                type="button"
                onClick={() => void activate()}
                disabled={publishing}
                className="shrink-0"
              >
                {publishing ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Rocket aria-hidden />
                )}
                {publishing ? 'Activando…' : 'Activar y avisar al cliente'}
              </Button>
            ) : (
              <p className="text-muted-foreground shrink-0 text-xs">
                Solo un administrador puede activarlo.
              </p>
            )}
          </div>
        ) : (
          <div className="border-border/60 bg-muted/20 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">El cliente ya tiene acceso al portal</p>
              <p className="text-muted-foreground text-xs">
                Puedes volver a enviarle el acceso por email o abrir WhatsApp con un mensaje
                preparado.
              </p>
            </div>
            {canEdit ? (
              <SendProjectPortalButton
                projectId={projectId}
                projectName={projectName}
                defaultEmail={clientEmail}
                defaultPhone={clientPhone}
                lastSentAt={inviteSentAt}
              />
            ) : null}
          </div>
        )}
        <FormFeedback state={feedback.state} />
        <div className="grid gap-4 lg:grid-cols-2">
          <CopyPortalLink path={`/p/project/${portalToken}`} label="Enlace de seguimiento" />
          {canEdit ? (
            <PortalAccessControls
              id={projectId}
              initialVisible={visible}
              hasPassword={hasPassword}
              action={updateProjectPortalAccess}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function SendProjectPortalButton({
  projectId,
  projectName,
  defaultEmail,
  defaultPhone,
  lastSentAt,
}: {
  projectId: string
  projectName: string
  defaultEmail: string | null
  defaultPhone: string | null
  lastSentAt: string | null
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultEmail ?? '')
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [clientName, setClientName] = useState('cliente')
  const [message, setMessage] = useState('')
  const [previewMessage, setPreviewMessage] = useState('')
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const loadPreview = async () => {
    setLoadingPreview(true)
    const result = await previewProjectPortalEmail({
      id: projectId,
      message: message.trim() || undefined,
    })
    if (result.ok) {
      setPreview({ subject: result.subject, html: result.html })
      setPreviewMessage(message)
      setClientName(result.clientName)
      setPortalUrl(result.portalUrl)
      if (!to.trim() && result.clientEmail) setTo(result.clientEmail)
      if (!phone.trim() && result.clientPhone) setPhone(result.clientPhone)
    } else {
      feedback.setError(result.error)
    }
    setLoadingPreview(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) void loadPreview()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!preview || previewMessage !== message) {
      feedback.setError('Actualiza la vista previa antes de enviar el email.')
      return
    }
    feedback.setPending()
    const result = await sendProjectPortalEmail({
      id: projectId,
      to: to.trim() || undefined,
      message: message.trim() || undefined,
    })
    if (!result.ok) {
      feedback.setError(result.error)
      return
    }
    feedback.setSuccess(result.mocked ? 'Email simulado (modo dev)' : 'Email enviado')
    setOpen(false)
    router.refresh()
  }

  const handleWhatsapp = () => {
    if (!phone.trim() || !portalUrl) return
    const text = message.trim()
      ? `${message.trim()}\n\n${portalUrl}`
      : buildProjectWhatsAppMessage(clientName, projectName, portalUrl)
    window.open(buildWhatsAppUrl(phone, text), '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(true)}>
        <Mail aria-hidden /> {lastSentAt ? 'Reenviar acceso' : 'Enviar acceso'}
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Enviar portal del cliente</DialogTitle>
            <DialogDescription>
              Revisa el mensaje y el destinatario antes de compartir el acceso al proyecto.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-portal-email">Email del cliente</Label>
                <Input
                  id="project-portal-email"
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="cliente@ejemplo.com"
                  required
                  autoComplete="email"
                  disabled={feedback.pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project-portal-message">Mensaje adicional (opcional)</Label>
                <Textarea
                  id="project-portal-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  maxLength={1000}
                  placeholder="Añade una nota personal para el cliente…"
                  disabled={feedback.pending}
                />
                {previewMessage !== message ? (
                  <p className="text-xs text-amber-700">
                    Actualiza la vista previa para incluir el mensaje.
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadPreview()}
                disabled={loadingPreview || feedback.pending}
              >
                {loadingPreview ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Actualizar vista previa
              </Button>
              <div className="border-border flex flex-col gap-1.5 border-t pt-4">
                <Label htmlFor="project-portal-phone">Teléfono para WhatsApp</Label>
                <Input
                  id="project-portal-phone"
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+34600000000"
                  autoComplete="tel"
                  disabled={feedback.pending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleWhatsapp}
                  disabled={!phone.trim() || !portalUrl || feedback.pending}
                >
                  <WhatsAppIcon className="mr-2" /> Compartir por WhatsApp
                </Button>
                <p className="text-muted-foreground text-xs">
                  Se abre WhatsApp con un mensaje preparado y el enlace del portal.
                </p>
              </div>
            </div>
            <div className="border-border bg-muted/30 overflow-hidden rounded-lg border">
              <div className="bg-background border-b px-4 py-3">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  Asunto
                </p>
                <p className="mt-1 text-sm font-medium">{preview?.subject ?? 'Cargando email…'}</p>
              </div>
              <div className="h-105 bg-white">
                {loadingPreview ? (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    <Loader2 className="animate-spin" aria-label="Cargando vista previa" />
                  </div>
                ) : preview ? (
                  <iframe
                    title="Vista previa del email"
                    srcDoc={preview.html}
                    sandbox=""
                    className="h-full w-full border-0"
                  />
                ) : (
                  <p className="text-muted-foreground p-4 text-sm">
                    No se pudo cargar la vista previa.
                  </p>
                )}
              </div>
            </div>
            <DialogFooter className="lg:col-span-2">
              <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={feedback.pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  feedback.pending || loadingPreview || !preview || previewMessage !== message
                }
              >
                <Mail aria-hidden /> {feedback.pending ? 'Enviando…' : 'Enviar email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
