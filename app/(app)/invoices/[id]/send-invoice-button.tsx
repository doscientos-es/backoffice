'use client'

import { LoaderCircle as Loader2, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'

import { logInvoiceWhatsappShare, previewInvoiceEmail, sendInvoiceEmail } from '../actions'

/**
 * Opens a dialog to share the public portal link of an invoice with the client.
 * The team reviews the exact rendered email and its recipient before delivery,
 * can attach the invoice PDF, or hand the link over to WhatsApp instead.
 * Shown only for issued invoices (the server action also re-validates this).
 *
 * The open state can be controlled from a parent (e.g. to pop it up right
 * after issuing the invoice); when `open`/`onOpenChange` are omitted it falls
 * back to managing its own state, triggered by the rendered button.
 */
export function SendInvoiceButton({
  invoiceId,
  defaultEmail,
  defaultPhone,
  lastSentAt = null,
  iconOnly = false,
  hideTrigger = false,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  invoiceId: string
  defaultEmail?: string | null
  defaultPhone?: string | null
  /** Timestamp of the most recent delivery, used to offer a re-send. */
  lastSentAt?: string | null
  /** Render the trigger as a square icon-only button (no label text). */
  iconOnly?: boolean
  /** Lets another control (such as a row-actions menu) open the dialog. */
  hideTrigger?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const [to, setTo] = useState(defaultEmail ?? '')
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const [message, setMessage] = useState('')
  const [attachPdf, setAttachPdf] = useState(true)
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [portalUrl, setPortalUrl] = useState<string | null>(null)
  const [previewMessage, setPreviewMessage] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sharingWhatsapp, setSharingWhatsapp] = useState(false)

  const loadPreview = async () => {
    setLoadingPreview(true)
    const messageForPreview = message.trim()
    const res = await previewInvoiceEmail({
      id: invoiceId,
      message: messageForPreview || undefined,
    })
    if (res.ok) {
      setPreview({ subject: res.subject, html: res.html })
      setPortalUrl(res.portalUrl)
      setPreviewMessage(message)
      if (!to.trim() && res.clientEmail) setTo(res.clientEmail)
      if (!phone.trim() && res.clientPhone) setPhone(res.clientPhone)
    } else {
      feedback.setError(res.error)
    }
    setLoadingPreview(false)
  }

  const onOpenChange = (next: boolean) => {
    if (setControlledOpen) setControlledOpen(next)
    else setUncontrolledOpen(next)
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
      attachPdf,
    })
    if (result.ok) {
      feedback.setSuccess(result.mocked ? 'Email simulado (sin Resend)' : 'Email enviado')
      onOpenChange(false)
      router.refresh()
    } else {
      feedback.setError(result.error)
    }
  }

  // WhatsApp is delivered by the team member from their own account: we open the
  // prefilled chat and only record that the link was shared.
  const handleWhatsapp = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!digits) {
      feedback.setError('Añade un teléfono para compartir por WhatsApp.')
      return
    }
    if (!portalUrl) {
      feedback.setError('Espera a que cargue la vista previa para obtener el enlace.')
      return
    }
    const note = message.trim()
    const text = note ? `${note}\n\n${portalUrl}` : `Aquí tienes tu factura: ${portalUrl}`
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    )
    setSharingWhatsapp(true)
    const result = await logInvoiceWhatsappShare({ id: invoiceId, phone: phone.trim() })
    setSharingWhatsapp(false)
    if (result.ok) {
      feedback.setSuccess('Envío por WhatsApp registrado')
      router.refresh()
    } else {
      feedback.setError(result.error)
    }
  }

  const triggerLabel = lastSentAt ? 'Reenviar al cliente' : 'Enviar al cliente'

  return (
    <>
      {hideTrigger ? null : iconOnly ? (
        <IconButton variant="outline" label={triggerLabel} onClick={() => onOpenChange(true)}>
          <Mail className="h-4 w-4" />
        </IconButton>
      ) : (
        <Button variant="outline" size="sm" onClick={() => onOpenChange(true)} type="button">
          <Mail className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Enviar la factura al cliente</DialogTitle>
            <DialogDescription>
              {lastSentAt
                ? `Ya se envió el ${formatDate(lastSentAt)}. Puedes volver a enviarla cuando quieras.`
                : 'Comprueba el destinatario y el contenido exacto que recibirá el cliente.'}
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
              <label
                htmlFor="invoice-email-attach-pdf"
                className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded p-1.5"
              >
                <Checkbox
                  id="invoice-email-attach-pdf"
                  isSelected={attachPdf}
                  onChange={setAttachPdf}
                  isDisabled={feedback.pending}
                />
                <span className="min-w-0">
                  <span className="block text-sm">Adjuntar el PDF de la factura</span>
                  <span className="text-muted-foreground block text-xs">
                    El email siempre incluye el enlace al portal de pago.
                  </span>
                </span>
              </label>
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
                <Label htmlFor="invoice-whatsapp-phone">Teléfono para WhatsApp</Label>
                <Input
                  id="invoice-whatsapp-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={defaultPhone ?? '+34600000000'}
                  autoComplete="tel"
                  disabled={feedback.pending || sharingWhatsapp}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleWhatsapp()}
                  disabled={!phone.trim() || !portalUrl || feedback.pending || sharingWhatsapp}
                >
                  <WhatsAppIcon className="mr-2" />
                  Compartir por WhatsApp
                </Button>
                <p className="text-muted-foreground text-xs">
                  Se abre WhatsApp con el enlace y la nota; el envío queda registrado.
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
                onClick={() => onOpenChange(false)}
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
