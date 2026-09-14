'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { CloudUpload, ExternalLink, LoaderCircle as Loader2, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { backupInternalDocToDrive, previewInternalDocEmail, sendInternalDocEmail } from '../actions'

type Props = {
  id: string
  name: string
  version: number
  driveBackupVersion: number | null
  driveBackupUrl: string | null
  driveConfigured: boolean
}

/** Backup and email delivery controls for a document's current file version. */
export function InternalDocActions({
  id,
  name,
  version,
  driveBackupVersion,
  driveBackupUrl,
  driveConfigured,
}: Props) {
  const router = useRouter()
  const [emailOpen, setEmailOpen] = useState(false)
  const [to, setTo] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [subject, setSubject] = useState(`Documento · ${name}`)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewKey, setPreviewKey] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const feedback = useFormFeedback({ successResetMs: 4000 })
  const backupFeedback = useFormFeedback({ successResetMs: 4000 })
  const [backupPending, startBackup] = useTransition()
  const backupIsStale = driveBackupVersion !== null && driveBackupVersion !== version
  const previewState = JSON.stringify({ recipientName, subject, message })

  async function loadPreview() {
    setLoadingPreview(true)
    const result = await previewInternalDocEmail({
      id,
      recipientName: recipientName.trim() || undefined,
      subject: subject.trim(),
      message: message.trim() || undefined,
    })
    if (result.ok) {
      setPreview({ subject: result.subject, html: result.html })
      setPreviewKey(previewState)
    } else {
      feedback.setError(result.error)
    }
    setLoadingPreview(false)
  }

  function onEmailOpenChange(open: boolean) {
    setEmailOpen(open)
    if (open) void loadPreview()
  }

  function backup() {
    backupFeedback.setPending()
    startBackup(async () => {
      const result = await backupInternalDocToDrive({ id })
      if (!result.ok) return backupFeedback.setError(result.error)
      backupFeedback.setSuccess(`Copia v${result.version} guardada en Drive`)
      router.refresh()
    })
  }

  function send(e: FormEvent) {
    e.preventDefault()
    if (!preview || previewKey !== previewState) {
      feedback.setError('Actualiza la vista previa antes de enviar el email.')
      return
    }
    feedback.setPending()
    void sendInternalDocEmail({
      id,
      to: to.trim(),
      recipientName: recipientName.trim() || undefined,
      subject: subject.trim(),
      message: message.trim() || undefined,
    }).then((result) => {
      if (!result.ok) return feedback.setError(result.error)
      feedback.setSuccess(result.mocked ? 'Email simulado (modo dev)' : 'Email enviado')
      onEmailOpenChange(false)
    })
  }

  const backupLabel =
    driveBackupVersion === null
      ? 'Guardar en Drive'
      : backupIsStale
        ? 'Actualizar copia en Drive'
        : 'Guardar de nuevo en Drive'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={backup}
          disabled={backupPending || !driveConfigured}
        >
          {backupPending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <CloudUpload aria-hidden />
          )}
          {backupLabel}
        </Button>
        {driveBackupUrl ? (
          <Button asChild type="button" size="sm" variant="ghost">
            <a href={driveBackupUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> Abrir en Drive
            </a>
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={() => onEmailOpenChange(true)}>
          <Mail aria-hidden /> Enviar por email
        </Button>
        <FormFeedback state={backupFeedback.state} pendingLabel="Guardando en Drive…" />
      </div>
      {driveBackupVersion === null ? null : backupIsStale ? (
        <p className="text-xs text-amber-700">
          La copia de Drive es de la v{driveBackupVersion}; el documento actual es la v{version}.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          La copia de Drive está actualizada (v{version}).
        </p>
      )}
      {!driveConfigured ? (
        <p className="text-muted-foreground text-xs">Drive no está configurado todavía.</p>
      ) : null}
      <Dialog open={emailOpen} onOpenChange={onEmailOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Enviar documento por email</DialogTitle>
            <DialogDescription>
              Personaliza el email y revisa exactamente lo que recibirá la persona destinataria.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={send}
            className="grid gap-4 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]"
          >
            <div className="flex flex-col gap-4">
              <Field label="Email del destinatario" htmlFor="internal-doc-email-to">
                <Input
                  id="internal-doc-email-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                  disabled={feedback.pending}
                />
              </Field>
              <Field label="Nombre del destinatario (opcional)" htmlFor="internal-doc-email-name">
                <Input
                  id="internal-doc-email-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  disabled={feedback.pending}
                />
              </Field>
              <Field label="Asunto" htmlFor="internal-doc-email-subject">
                <Input
                  id="internal-doc-email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  disabled={feedback.pending}
                />
              </Field>
              <Field label="Mensaje adicional (opcional)" htmlFor="internal-doc-email-message">
                <Textarea
                  id="internal-doc-email-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  maxLength={1000}
                  disabled={feedback.pending}
                />
              </Field>
              {previewKey !== previewState ? (
                <p className="text-xs text-amber-700">
                  Actualiza la vista previa para incluir tus cambios.
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadPreview()}
                disabled={loadingPreview || feedback.pending}
              >
                {loadingPreview ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Actualizar vista previa
              </Button>
              <p className="text-muted-foreground text-xs">
                Se adjuntará el archivo actual: {name}.
              </p>
            </div>
            <EmailPreview preview={preview} loading={loadingPreview} />
            <DialogFooter className="lg:col-span-2">
              <FormFeedback state={feedback.state} pendingLabel="Enviando…" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEmailOpenChange(false)}
                disabled={feedback.pending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  feedback.pending || loadingPreview || !preview || previewKey !== previewState
                }
              >
                <Mail aria-hidden />
                {feedback.pending ? 'Enviando…' : 'Enviar email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Field({
  children,
  label,
  htmlFor,
}: {
  children: React.ReactNode
  label: string
  htmlFor: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function EmailPreview({
  preview,
  loading,
}: {
  preview: { subject: string; html: string } | null
  loading: boolean
}) {
  return (
    <div className="border-border bg-muted/30 overflow-hidden rounded-lg border">
      <div className="bg-background border-b px-4 py-3">
        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          Asunto
        </p>
        <p className="mt-1 text-sm font-medium">{preview?.subject ?? 'Cargando email…'}</p>
      </div>
      <div className="h-105 bg-white">
        {loading ? (
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
          <p className="text-muted-foreground p-4 text-sm">No se pudo cargar la vista previa.</p>
        )}
      </div>
    </div>
  )
}
