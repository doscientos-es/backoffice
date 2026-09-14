import { BellRing, CircleCheck, CircleX, Mail, ReceiptText, Wallet } from 'lucide-react'
import type { ComponentType } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { InvoiceDelivery } from '@/lib/invoices/types'
import { formatDateTime, formatEUR } from '@/lib/utils'

type TimelineIcon = ComponentType<{ className?: string }>

export type InvoiceTimelineEvent = {
  id: string
  date: string
  label: string
  detail: string
  icon: TimelineIcon
  tone: 'default' | 'success' | 'warning' | 'danger'
}

type Payment = {
  id: string
  amount: number
  status: string
  created_at: string
  confirmed_at: string | null
}

type Automation = {
  id: string
  status: string
  run_at: string
  sent_at: string | null
  cancelled_at: string | null
}

export function buildInvoiceTimeline({
  issueDate,
  deliveries,
  payments,
  automation,
}: {
  issueDate: string | null
  deliveries: InvoiceDelivery[]
  payments: Payment[]
  automation: Automation | null
}): InvoiceTimelineEvent[] {
  const events: InvoiceTimelineEvent[] = []
  if (issueDate) {
    events.push({
      id: 'issued',
      date: issueDate,
      label: 'Factura emitida',
      detail: 'Documento generado y listo para entregar',
      icon: ReceiptText,
      tone: 'default',
    })
  }

  for (const delivery of deliveries) {
    events.push({
      id: `delivery-${delivery.id}`,
      date: delivery.created_at,
      label: `Factura enviada por ${delivery.channel === 'email' ? 'email' : 'WhatsApp'}`,
      detail: delivery.recipient ?? 'Destinatario no indicado',
      icon: Mail,
      tone: 'default',
    })
  }

  for (const payment of payments) {
    const confirmed = payment.status === 'confirmed'
    events.push({
      id: `payment-${payment.id}`,
      date: payment.confirmed_at ?? payment.created_at,
      label: confirmed ? 'Cobro confirmado' : 'Intento de cobro',
      detail: `${formatEUR(Number(payment.amount))} · ${confirmed ? 'registrado' : payment.status}`,
      icon: Wallet,
      tone: confirmed ? 'success' : payment.status === 'failed' ? 'danger' : 'warning',
    })
  }

  if (automation) {
    const isSent = automation.status === 'sent'
    const isCancelled = automation.status === 'cancelled'
    events.push({
      id: `automation-${automation.id}`,
      date: isSent
        ? (automation.sent_at ?? automation.run_at)
        : (automation.cancelled_at ?? automation.run_at),
      label: isSent
        ? 'Seguimiento automático enviado'
        : isCancelled
          ? 'Seguimiento automático cancelado'
          : automation.status === 'failed'
            ? 'Falló el seguimiento automático'
            : 'Seguimiento automático programado',
      detail: isSent || isCancelled ? '' : `Previsto para ${formatDateTime(automation.run_at)}`,
      icon: isSent ? CircleCheck : isCancelled ? CircleX : BellRing,
      tone: isSent
        ? 'success'
        : isCancelled
          ? 'default'
          : automation.status === 'failed'
            ? 'danger'
            : 'warning',
    })
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function InvoiceTimeline({
  issueDate,
  deliveries,
  payments,
  automation,
}: {
  issueDate: string | null
  deliveries: InvoiceDelivery[]
  payments: Payment[]
  automation: Automation | null
}) {
  const events = buildInvoiceTimeline({ issueDate, deliveries, payments, automation })
  if (events.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial</CardTitle>
        <p className="text-muted-foreground text-sm">
          Emisión, envíos, cobros y automatizaciones en un solo sitio.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="border-border ml-2 border-l pl-5">
          {events.map((event) => {
            const Icon = event.icon
            return (
              <li key={event.id} className="relative pb-4 last:pb-0">
                <span className="bg-background border-border absolute top-0.5 -left-[2.05rem] flex size-6 items-center justify-center rounded-full border">
                  <Icon className="text-muted-foreground size-3.5" aria-hidden />
                </span>
                <p className="text-sm font-medium">{event.label}</p>
                {event.detail ? (
                  <p className="text-muted-foreground text-xs">{event.detail}</p>
                ) : null}
                <time className="text-muted-foreground text-[11px]" dateTime={event.date}>
                  {formatDateTime(event.date)}
                </time>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
