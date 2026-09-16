'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { Mail } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { sendDocumentEmail } from './actions'

export function SendDocumentDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [subject, setSubject] = useState(`Documento · ${name}`)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const result = await sendDocumentEmail({
      id,
      to,
      recipientName: recipientName || undefined,
      subject,
      message: message || undefined,
    })
    if (result.ok) {
      setOpen(false)
      setTo('')
      setMessage('')
    } else setError(result.error)
    setPending(false)
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Mail className="size-3.5" />
        Enviar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar documento</DialogTitle>
            <DialogDescription>Se adjuntará el PDF actual al email.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="document-email-to">
              Email destinatario
              <Input
                id="document-email-to"
                type="email"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="document-email-name">
              Nombre (opcional)
              <Input
                id="document-email-name"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="document-email-subject">
              Asunto
              <Input
                id="document-email-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="document-email-message">
              Mensaje (opcional)
              <Textarea
                id="document-email-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                maxLength={2000}
              />
            </label>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Enviando…' : 'Enviar PDF'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
