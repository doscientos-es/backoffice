import {
  SquareCheck as CheckSquare2,
  FileText as FileSignature,
  Mail,
  MessageSquare,
  Phone,
  Receipt as ReceiptText,
  StickyNote,
} from 'lucide-react'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MemberLabel } from '@/components/ui/member-avatar'
import {
  groupResendInteractions,
  interactionBodyText,
  interactionDate,
} from '@/lib/leads/interaction-utils'
import type {
  LeadDetailInteraction,
  LeadRelatedInvoice,
  LeadRelatedProposal,
  LeadRelatedTask,
} from '@/lib/leads/types'
import { formatDate, formatEUR, relativeTime } from '@/lib/utils'

import { CallInteractionDetails } from './call-interaction-details'
import { DeleteLeadInteractionButton } from './delete-lead-interaction-button'
import { EmailDeliveryStatuses } from './email-delivery-statuses'
import { LeadInteractionDetails } from './lead-interaction-details'

const INTERACTION_LABEL: Record<string, string> = {
  email_sent: 'Email enviado',
  email_received: 'Email recibido',
  email_delivered: 'Email entregado',
  email_opened: 'Email abierto',
  email_clicked: 'Email con clic',
  email_bounced: 'Email rebotado',
  email_complained: 'Email marcado como spam',
  email_scheduled: 'Email programado',
  email_delivery_delayed: 'Entrega de email retrasada',
  email_failed: 'Error al enviar el email',
  email_suppressed: 'Email suprimido',
  call: 'Llamada',
  meeting: 'Reunión',
  note: 'Nota',
  owner_change: 'Responsable cambiado',
  status_change: 'Cambio de estado',
  portal_view: 'Portal visto',
  portal_accept: 'Propuesta aceptada',
  portal_reject: 'Propuesta rechazada',
}

type InteractionEvent = {
  kind: 'interaction'
  id: string
  date: string
  label: string
  interaction: LeadDetailInteraction
  statuses: string[]
}

type RecordEvent = {
  kind: 'record'
  id: string
  date: string
  label: string
  detail: string | null
  href: string
  icon: typeof Mail
}

type ActivityEvent = InteractionEvent | RecordEvent

type LeadActivityFeedProps = {
  leadId: string
  leadEmail: string | null
  canEdit: boolean
  aiEnabled: boolean
  interactions: LeadDetailInteraction[]
  proposals: LeadRelatedProposal[]
  invoices: LeadRelatedInvoice[]
  tasks: LeadRelatedTask[]
}

function interactionIcon(type: string) {
  if (type === 'call') return Phone
  if (type === 'note') return StickyNote
  if (type.startsWith('email_')) return Mail
  return MessageSquare
}

/** Trims the interaction body (HTML for emails, plain text otherwise) for the feed. */
function excerpt(body: string | null, max = 160): string | null {
  const text = interactionBodyText(body)?.replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function dayKey(value: string) {
  const date = new Date(value)
  return [date.getFullYear(), date.getMonth(), date.getDate()].join('-')
}

function dayLabel(value: string, now = new Date()) {
  const date = new Date(value)
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const elapsedDays = Math.round((currentDay - eventDay) / 86_400_000)
  if (elapsedDays === 0) return 'Hoy'
  if (elapsedDays === 1) return 'Ayer'
  return formatDate(value)
}

function groupEventsByDay(events: ActivityEvent[]) {
  const groups = new Map<string, { label: string; events: ActivityEvent[] }>()
  for (const event of events) {
    const key = dayKey(event.date)
    const current = groups.get(key)
    if (current) current.events.push(event)
    else groups.set(key, { label: dayLabel(event.date), events: [event] })
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
}

function buildEvents({
  interactions,
  proposals,
  invoices,
  tasks,
}: Pick<
  LeadActivityFeedProps,
  'interactions' | 'proposals' | 'invoices' | 'tasks'
>): ActivityEvent[] {
  const interactionEvents: ActivityEvent[] = groupResendInteractions(interactions).map(
    ({ interaction, latestInteraction, statuses }) => ({
      kind: 'interaction' as const,
      id: `interaction-${interaction.id}`,
      date: interactionDate(latestInteraction),
      label: interaction.resend_email_id
        ? statuses.includes('email_received')
          ? 'Email recibido'
          : 'Email enviado'
        : (INTERACTION_LABEL[interaction.type] ?? interaction.type),
      interaction,
      statuses,
    }),
  )

  const proposalEvents: ActivityEvent[] = proposals.flatMap((item) => {
    const date = item.responded_at ?? item.viewed_at ?? item.sent_at
    if (!date) return []
    return [
      {
        kind: 'record' as const,
        id: `proposal-${item.id}`,
        date,
        label: item.status === 'accepted' ? 'Propuesta aceptada' : 'Propuesta en seguimiento',
        detail: [item.number ?? 'Propuesta', item.total != null ? formatEUR(Number(item.total)) : null]
          .filter(Boolean)
          .join(' · '),
        href: `/proposals/${item.id}`,
        icon: FileSignature,
      },
    ]
  })

  const invoiceEvents: ActivityEvent[] = invoices.flatMap((item) => {
    if (!item.issue_date) return []
    return [
      {
        kind: 'record' as const,
        id: `invoice-${item.id}`,
        date: item.issue_date,
        label: item.status === 'overdue' ? 'Factura vencida' : 'Factura emitida',
        detail: [
          item.full_number ?? 'Factura',
          item.total != null ? formatEUR(Number(item.total)) : null,
        ]
          .filter(Boolean)
          .join(' · '),
        href: `/invoices/${item.id}`,
        icon: ReceiptText,
      },
    ]
  })

  const taskEvents: ActivityEvent[] = tasks.flatMap((item) => {
    if (!item.due_date) return []
    return [
      {
        kind: 'record' as const,
        id: `task-${item.id}`,
        date: item.due_date,
        label: item.status === 'done' ? 'Tarea completada' : 'Tarea pendiente',
        detail: item.title,
        href: `/tasks/${item.id}`,
        icon: CheckSquare2,
      },
    ]
  })

  return [...interactionEvents, ...proposalEvents, ...invoiceEvents, ...taskEvents].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

/** Unified chronological feed: interactions plus proposal, invoice and task milestones. */
export function LeadActivityFeed({
  leadId,
  leadEmail,
  canEdit,
  aiEnabled,
  interactions,
  proposals,
  invoices,
  tasks,
}: LeadActivityFeedProps) {
  const events = buildEvents({ interactions, proposals, invoices, tasks })
  const groups = groupEventsByDay(events)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Actividad</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm font-normal">
            Interacciones y movimientos comerciales en orden cronológico.
          </p>
        </div>
        {events[0] ? (
          <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
            Última {relativeTime(events[0].date)}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin actividad registrada.</p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} aria-label={`Actividad: ${group.label}`}>
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {group.label}
                </p>
                <ol className="divide-border divide-y">
                  {group.events.map((event) =>
                    event.kind === 'record' ? (
                      <RecordRow key={event.id} event={event} />
                    ) : (
                      <InteractionRow
                        key={event.id}
                        event={event}
                        leadId={leadId}
                        leadEmail={leadEmail}
                        canEdit={canEdit}
                        aiEnabled={aiEnabled}
                      />
                    ),
                  )}
                </ol>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RecordRow({ event }: { event: RecordEvent }) {
  const Icon = event.icon
  return (
    <li className="py-2.5">
      <Link href={event.href} className="flex items-start gap-3 hover:opacity-75">
        <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{event.label}</p>
          {event.detail ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{event.detail}</p>
          ) : null}
        </div>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {relativeTime(event.date)}
        </span>
      </Link>
    </li>
  )
}

function InteractionRow({
  event,
  leadId,
  leadEmail,
  canEdit,
  aiEnabled,
}: {
  event: InteractionEvent
  leadId: string
  leadEmail: string | null
  canEdit: boolean
  aiEnabled: boolean
}) {
  const interaction = event.interaction
  const type = interaction.type
  const snippet = excerpt(interaction.body)
  const Icon = interactionIcon(type)

  return (
    <li className="py-2.5">
      <article className="flex items-start gap-3">
        <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold">{event.label}</p>
            <EmailDeliveryStatuses statuses={event.statuses} />
          </div>
          {interaction.subject ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{interaction.subject}</p>
          ) : null}
          {snippet ? (
            <p className="text-muted-foreground/90 mt-1 line-clamp-2 text-xs leading-relaxed">
              {snippet}
            </p>
          ) : null}
        </div>
        <div className="text-muted-foreground flex shrink-0 flex-col items-end gap-1 text-xs">
          <span className="tabular-nums">{relativeTime(event.date)}</span>
          {interaction.performer ? (
            <MemberLabel
              member={interaction.performer}
              size="xs"
              className="text-muted-foreground/70 gap-1 text-[11px]"
            />
          ) : null}
          <div className="flex flex-wrap justify-end gap-0.5">
            {type === 'call' ? (
              <CallInteractionDetails interaction={interaction} leadId={leadId} canEdit={canEdit} />
            ) : (
              <LeadInteractionDetails
                interaction={interaction}
                label={event.label}
                leadId={leadId}
                leadEmail={leadEmail}
                canReply={canEdit}
                aiEnabled={aiEnabled}
              />
            )}
            {type === 'note' && canEdit ? (
              <DeleteLeadInteractionButton
                leadId={leadId}
                interactionId={interaction.id}
                label="nota"
              />
            ) : null}
          </div>
        </div>
      </article>
    </li>
  )
}
