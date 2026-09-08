'use client'

import { LoaderCircle as Loader2, Mail } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { previewInvoiceEmail, sendInvoiceEmail } from '../actions'

/**
 * Opens a dialog to email the public portal link of an invoice to the client.
 * The team reviews the exact rendered email and its recipient before delivery.
 * Shown only for issued invoices (the server action also re-validates this).
 */
export function SendInvoiceButton({
  invoiceId,
  defaultEmail,
  iconOnly = false,
}: {
  invoiceId: string
  defaultEmail?: string | null
  /** Render the trigger as a square icon-only button (no label text). */
  iconOnly?: boolean
}) {
  const feedback = useFormFeedback()
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState(defaultEmail ?? '')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewMessage, setPreviewMessage] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  const loadPreview = async () => {
    setLoadingPreview(true)
    const messageForPreview = message.trim()
    const res = await previewInvoiceEmail({
      id: invoiceId,
      message: messageForPreview || undefined,
    })
    if (res.ok) {
      setPreview({ subject: res.subject, html: res.html })
      setPreviewMessage(message)
      if (!to.trim() && res.clientEmail) setTo(res.clientEmail)
    } else {
      feedback.setError(res.error)
    }
    setLoadingPreview(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) void loadPreview()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!preview || previewMessage !== message) {
      feedback.setError('Actualiza la vista previa antes de enviar el email.')
      return
    }
    feedback.setPending()
    const result = await sendInvoiceEmail({
      id: invoiceId,
      to: to.trim() || undefined,
      message: message.trim() || undefined,
    })
    if (result.ok) {
      feedback.setSuccess(result.mocked ? 'Email simulado (sin Resend)' : 'Email enviado')
      setOpen(false)
    } else {
      feedback.setError(result.error)
    }
  }

  return (
    <>
      {iconOnly ? (
        <IconButton
          variant="outline"
          label="Enviar email al cliente"
          onClick={() => onOpenChange(true)}
        >
          <Mail className="h-4 w-4" />
        </IconButton>
      ) : (
        <Button variant="outline" size="sm" onClick={() => onOpenChange(true)}>
          <Mail className="mr-2 h-4 w-4" />
          Enviar email
        </Button>
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Revisar email antes de enviarlo</DialogTitle>
            <DialogDescription>
              Comprueba el destinatario y el contenido exacto que recibirá el cliente.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice-email-to">Email del cliente</Label>
                <Input
                  id="invoice-email-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder={defaultEmail ?? 'cliente@ejemplo.com'}
                  required
                  autoComplete="email"
                  disabled={feedback.pending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invoice-email-message">Mensaje adicional (opcional)</Label>
                <Textarea
                  id="invoice-email-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
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
                <Mail className="h-4 w-4" aria-hidden />
                {feedback.pending ? 'Enviando…' : 'Enviar email'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
