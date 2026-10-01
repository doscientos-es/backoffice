'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { MessageSquarePlus, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { submitProjectRequest } from './actions'

export function ProjectRequestDialog({
  token,
  language = 'es',
}: {
  token: string
  language?: 'es' | 'ca' | 'en'
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <MessageSquarePlus className="size-3.5" aria-hidden="true" />
          {language === 'ca' ? 'Nova' : language === 'en' ? 'New' : 'Nueva'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {language === 'ca'
              ? 'Nova sol·licitud'
              : language === 'en'
                ? 'New request'
                : 'Nueva solicitud'}
          </DialogTitle>
          <DialogDescription>
            {language === 'ca'
              ? 'Explica’ns què necessites i quedarà registrat al projecte.'
              : language === 'en'
                ? 'Tell us what you need and it will be recorded in the project.'
                : 'Cuéntanos qué necesitas y quedará registrado en el proyecto.'}
          </DialogDescription>
        </DialogHeader>
        <ProjectRequestForm token={token} language={language} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

export function ProjectRequestForm({
  token,
  language = 'es',
  onSuccess,
}: {
  token: string
  language?: 'es' | 'ca' | 'en'
  onSuccess?: () => void
}) {
  const router = useRouter()
  const feedback = useFormFeedback()
  const [sent, setSent] = useState(false)
  const copy =
    language === 'ca'
      ? {
          sent: 'Sol·licitud enviada correctament',
          retry: 'No s’ha pogut enviar. Comprova la connexió i torna-ho a provar.',
          form: 'Nova sol·licitud',
          name: 'Nom',
          yourName: 'El teu nom',
          emailOptional: 'Email (opcional)',
          category: 'En què et podem ajudar?',
          options: [
            'Tinc una consulta',
            'Vull comunicar una incidència',
            'Necessito demanar un canvi',
            'Vull lliurar material',
            'Necessito manteniment',
            'Vull presentar una queixa',
          ],
          subject: 'Assumpte',
          subjectPlaceholder: 'Resumeix breument la sol·licitud',
          description: 'Descripció',
          descriptionPlaceholder: 'Inclou el context i tots els detalls que consideris útils…',
          sending: 'Enviant…',
          another: 'Enviar una altra sol·licitud',
          submit: 'Enviar sol·licitud',
        }
      : language === 'en'
        ? {
            sent: 'Request sent successfully',
            retry: 'Could not send. Check your connection and try again.',
            form: 'New request',
            name: 'Name',
            yourName: 'Your name',
            emailOptional: 'Email (optional)',
            category: 'How can we help?',
            options: [
              'I have a question',
              'I want to report an issue',
              'I need to request a change',
              'I want to provide materials',
              'I need maintenance',
              'I want to submit a complaint',
            ],
            subject: 'Subject',
            subjectPlaceholder: 'Briefly summarize your request',
            description: 'Description',
            descriptionPlaceholder: 'Include the context and any useful details…',
            sending: 'Sending…',
            another: 'Send another request',
            submit: 'Send request',
          }
        : {
            sent: 'Solicitud enviada correctamente',
            retry: 'No se pudo enviar. Comprueba tu conexión e inténtalo de nuevo.',
            form: 'Nueva solicitud',
            name: 'Nombre',
            yourName: 'Tu nombre',
            emailOptional: 'Email (opcional)',
            category: '¿En qué podemos ayudarte?',
            options: [
              'Tengo una consulta',
              'Quiero comunicar una incidencia',
              'Necesito solicitar un cambio',
              'Quiero entregar material',
              'Necesito mantenimiento',
              'Quiero presentar una queja',
            ],
            subject: 'Asunto',
            subjectPlaceholder: 'Resume brevemente tu solicitud',
            description: 'Descripción',
            descriptionPlaceholder:
              'Incluye el contexto y todos los detalles que consideres útiles…',
            sending: 'Enviando…',
            another: 'Enviar otra solicitud',
            submit: 'Enviar solicitud',
          }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    setSent(false)
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const result = await submitProjectRequest({
        token,
        category: data.get('category')?.toString(),
        subject: data.get('subject')?.toString(),
        body: data.get('body')?.toString(),
        requesterName: data.get('requester_name')?.toString(),
        requesterEmail: data.get('requester_email')?.toString(),
        website: data.get('website')?.toString(),
      })
      if (!result.ok) return feedback.setError(result.error)
      form.reset()
      setSent(true)
      feedback.setSuccess(copy.sent)
      router.refresh()
      onSuccess?.()
    } catch {
      feedback.setError(copy.retry)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" aria-label={copy.form}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="requester-name" className="mb-1.5 block text-sm font-medium">
            {copy.name}
          </label>
          <Input
            id="requester-name"
            name="requester_name"
            required
            maxLength={160}
            autoComplete="name"
            placeholder={copy.yourName}
            className="h-10 bg-white dark:bg-white/[0.04]"
          />
        </div>
        <div>
          <label htmlFor="requester-email" className="mb-1.5 block text-sm font-medium">
            {copy.emailOptional}
          </label>
          <Input
            id="requester-email"
            name="requester_email"
            type="email"
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            placeholder="name@company.com"
            className="h-10 bg-white dark:bg-white/[0.04]"
          />
        </div>
      </div>
      <div>
        <label htmlFor="request-category" className="mb-1.5 block text-sm font-medium">
          {copy.category}
        </label>
        <Select
          id="request-category"
          name="category"
          defaultValue="question"
          className="h-10 bg-white dark:bg-white/[0.04]"
        >
          {(
            ['question', 'incident', 'change', 'material', 'maintenance', 'complaint'] as const
          ).map((value, index) => (
            <option key={value} value={value}>
              {copy.options[index]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <label htmlFor="request-subject" className="mb-1.5 block text-sm font-medium">
          {copy.subject}
        </label>
        <Input
          id="request-subject"
          name="subject"
          required
          maxLength={160}
          placeholder={copy.subjectPlaceholder}
          className="h-10 bg-white dark:bg-white/[0.04]"
        />
      </div>
      <div>
        <label htmlFor="request-body" className="mb-1.5 block text-sm font-medium">
          {copy.description}
        </label>
        <Textarea
          id="request-body"
          name="body"
          required
          rows={5}
          maxLength={4000}
          placeholder={copy.descriptionPlaceholder}
          className="min-h-32 resize-y bg-white dark:bg-white/[0.04]"
        />
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="request-website">Website</label>
        <input id="request-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite">
          <FormFeedback state={feedback.state} />
        </div>
        <Button
          type="submit"
          size="lg"
          disabled={feedback.pending}
          aria-busy={feedback.pending}
          className="h-10 rounded-xl px-4"
        >
          {feedback.pending ? copy.sending : sent ? copy.another : copy.submit}
          <Send className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </form>
  )
}
