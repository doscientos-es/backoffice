'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { CheckCircle2, Phone, PhoneOff } from 'lucide-react'
import Image from 'next/image'
import { toDataURL } from 'qrcode'
import { useEffect, useState } from 'react'

import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { publicEnv } from '@/lib/env'
import { CALL_REMINDER_SCHEDULED_EVENT } from '@/lib/leads/call-workflow'
import { buildBookingUrl } from '@/lib/recovery/utils'

import { finishLeadCall, getLeadCallSession, markLeadCallDialed, startLeadCall } from '../actions'
import { WhatsAppComposer } from '../whatsapp-composer'

const TERMINAL_CALL_STATUSES = new Set(['awaiting_log', 'logged', 'abandoned'])
const CALL_SESSION_POLL_INTERVAL_MS = 15_000

/**
 * Normalises a raw phone string into a clean `tel:` URI value.
 *
 * Rules (in order):
 * 1. Strip everything except digits and `+`.
 * 2. If `+` appears in the middle (e.g. `835+34…`), discard the prefix and
 *    keep from the `+` onwards — this handles operator/country-code prefixes
 *    that leads sometimes include when self-entering their number.
 * 3. Otherwise return the cleaned string as-is.
 */
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  const plusIndex = cleaned.indexOf('+')
  if (plusIndex > 0) return cleaned.slice(plusIndex)
  return cleaned
}

/**
 * Renders a phone number as a clickable `tel:` link plus quick actions to
 * "send" the call to a mobile device from a desktop session:
 * - Copy the number to the clipboard (paste it into the phone).
 * - Scan a QR code with the phone's camera and preserve the session state.
 */
export function LeadCallLink({
  leadId,
  phone,
  children,
  className,
  ...props
}: {
  leadId: string
  phone: string
  children: React.ReactNode
  className?: string
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const [session, setSession] = useState<{ id: string; mobileToken: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    event.stopPropagation()
    setStarting(true)
    setError(null)
    const result = await startLeadCall({ leadId, source: 'desktop' })
    setStarting(false)
    if (!result.ok) return setError(result.error)
    window.dispatchEvent(new Event(CALL_REMINDER_SCHEDULED_EVENT))
    setSession({ id: result.id, mobileToken: result.mobileToken })
  }

  return (
    <>
      <a
        {...props}
        href={`tel:${normalizePhone(phone)}`}
        onClick={handleClick}
        className={className}
      >
        {children}
      </a>
      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
      {starting && <span className="text-xs text-muted-foreground">Preparando…</span>}
      {session && (
        <CallTrackingDialog
          leadId={leadId}
          phone={phone}
          session={session}
          onOpenChange={(open) => {
            if (!open) setSession(null)
          }}
        />
      )}
    </>
  )
}

export function PhoneQuickActions({
  phone,
  leadId,
  leadName,
  leadEmail,
  leadLanguage,
  firstContactedAt,
  senderName,
  aiEnabled,
}: {
  phone: string
  leadId?: string
  leadName?: string
  leadEmail?: string | null
  leadLanguage?: string | null
  firstContactedAt?: string | null
  senderName: string
  aiEnabled?: boolean
}) {
  const normalized = normalizePhone(phone)
  return (
    <div className="flex items-center gap-1.5">
      {leadId ? (
        <LeadCallLink
          leadId={leadId}
          phone={phone}
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {phone}
        </LeadCallLink>
      ) : (
        <a
          href={`tel:${normalized}`}
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {phone}
        </a>
      )}
      <CopyButton text={normalized} successMessage="Teléfono copiado" label="Copiar teléfono" />
      {leadId && leadName && (
        <LeadWhatsAppButton
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail ?? null}
          leadLanguage={leadLanguage}
          phone={phone}
          firstContactedAt={firstContactedAt}
          senderName={senderName}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  )
}

export function LeadWhatsAppButton({
  leadId,
  leadName,
  leadEmail,
  leadLanguage,
  phone,
  firstContactedAt,
  senderName,
  aiEnabled,
}: {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadLanguage?: string | null
  phone: string
  firstContactedAt?: string | null
  senderName: string
  aiEnabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const bookingUrl = buildBookingUrl(publicEnv.NEXT_PUBLIC_CAL_LINK, {
    id: leadId,
    name: leadName,
    email: leadEmail,
  })
  const firstName = leadName.split(' ')[0] || leadName
  const initialMessage = [
    `Hola, ${firstName}. Soy ${senderName || 'el equipo'}, de Doscientos.`,
    'He intentado llamarte porque rellenaste un formulario en uno de nuestros anuncios de Meta.',
    'Me gustaría entender qué necesitas y ver si podemos ayudarte.',
    bookingUrl
      ? `Puedes contarme brevemente por aquí o, si lo prefieres, agendar una reunión: ${bookingUrl}`
      : 'Puedes contarme brevemente por aquí y te respondo en cuanto pueda.',
    '¿Qué te resulta más cómodo?',
  ].join('\n\n')
  const message = firstContactedAt
    ? `Hola, ${firstName}. Soy ${senderName || 'el equipo'}, de Doscientos.`
    : initialMessage
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Preparar WhatsApp"
          title="Preparar WhatsApp"
          className="size-6 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-500/10"
        >
          <WhatsAppIcon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preparar WhatsApp</DialogTitle>
          <DialogDescription>
            Envía el mensaje en WhatsApp y confírmalo después para registrarlo.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppComposer
          leadId={leadId}
          leadName={leadName}
          leadEmail={leadEmail}
          leadPhone={phone}
          defaultLanguage={leadLanguage ?? undefined}
          senderName={senderName}
          aiEnabled={aiEnabled}
          defaultMessage={message}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function CallTrackingDialog({
  leadId,
  phone,
  session,
  onOpenChange,
}: {
  leadId: string
  phone: string
  session: { id: string; mobileToken: string }
  onOpenChange: (open: boolean) => void
}) {
  const [qr, setQr] = useState<string | null>(null)
  const [status, setStatus] = useState('started')
  const [completion, setCompletion] = useState<{
    durationMinutes: number
    defaultOutcome: 'connected' | 'no_answer'
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setQr(null)
    const url = new URL(`/p/call/${session.mobileToken}`, window.location.origin).toString()
    toDataURL(url, { width: 200, margin: 1 })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        if (!cancelled) setQr(null)
      })
    return () => {
      cancelled = true
    }
  }, [session.mobileToken])

  const polling = !TERMINAL_CALL_STATUSES.has(status)

  useEffect(() => {
    if (!polling) return
    let cancelled = false
    async function refreshSession() {
      if (document.visibilityState === 'hidden') return
      const result = await getLeadCallSession({ leadId, sessionId: session.id })
      if (cancelled || !result.ok) return
      setStatus(result.status)
      if (result.durationMinutes !== null && result.defaultOutcome) {
        setCompletion({
          durationMinutes: result.durationMinutes,
          defaultOutcome: result.defaultOutcome,
        })
      }
    }
    void refreshSession()
    const timer = window.setInterval(() => void refreshSession(), CALL_SESSION_POLL_INTERVAL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refreshSession()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [leadId, session.id, polling])

  async function callFromThisDevice() {
    setPending(true)
    setError(null)
    const result = await markLeadCallDialed({ leadId, sessionId: session.id })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setStatus('dialing')
    window.location.assign(`tel:${normalizePhone(phone)}`)
  }

  async function finishCall() {
    setPending(true)
    setError(null)
    const result = await finishLeadCall({ leadId, sessionId: session.id })
    setPending(false)
    if (!result.ok) return setError(result.error)
    setStatus('awaiting_log')
    setCompletion({
      durationMinutes: result.durationMinutes,
      defaultOutcome: result.defaultOutcome,
    })
  }

  function registerCall() {
    const params = new URLSearchParams({ feedback: 'call', callSessionId: session.id })
    if (completion) {
      params.set('duration', String(completion.durationMinutes))
      params.set('outcome', completion.defaultOutcome)
    }
    window.location.assign(`/leads/${leadId}?${params.toString()}`)
  }

  const isFinished = status === 'awaiting_log' || status === 'logged'

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Llamando a {normalizePhone(phone)}</DialogTitle>
          <DialogDescription>
            La duración es estimada. Confirma siempre el resultado y las notas.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="flex size-[200px] items-center justify-center rounded-md bg-muted">
            {qr ? (
              <Image
                src={qr}
                alt="QR para continuar la llamada desde el móvil"
                width={200}
                height={200}
                unoptimized
              />
            ) : (
              <span className="text-xs text-muted-foreground">Generando…</span>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Escanea el QR para abrir el teléfono móvil sin perder el seguimiento.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {status === 'logged' ? (
          <p className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-emerald-600" /> Resultado ya registrado
          </p>
        ) : isFinished ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-4 text-emerald-600" /> Llamada finalizada
              {completion ? ` · ${completion.durationMinutes} min estimados` : ''}
            </p>
            <Button type="button" onClick={registerCall}>
              Registrar resultado
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={callFromThisDevice}
              disabled={pending}
              className="gap-2"
            >
              <Phone className="size-4" /> Llamar aquí
            </Button>
            <Button type="button" onClick={finishCall} disabled={pending} className="gap-2">
              <PhoneOff className="size-4" /> Terminar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
