import { Mail, Phone, StickyNote, Calendar, ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  excerptInteractionBody,
  groupResendInteractions,
  interactionDate,
} from '@/lib/leads/interaction-utils'
import type { LeadDetailInteraction } from '@/lib/leads/types'
import { relativeTime } from '@/lib/utils'

import { CallInteractionDetails } from './call-interaction-details'
import { LeadInteractionDetails } from './lead-interaction-details'

const LABEL: Record<string, string> = {
  email_sent: 'Email enviado',
  email_received: 'Email recibido',
  call: 'Llamada',
  meeting: 'Reunión',
  note: 'Nota',
}

type LeadRecentInteractionsProps = {
  leadId: string
  leadEmail: string | null
  canEdit: boolean
  aiEnabled: boolean
  interactions: LeadDetailInteraction[]
  /** How many interactions to show before linking to the full activity tab. */
  limit?: number
  /** Total events available in the full activity tab, to show the history link. */
  totalActivityEvents?: number
}

function icon(type: string) {
  if (type === 'call') return Phone
  if (type === 'note') return StickyNote
  if (type === 'meeting') return Calendar
  return Mail
}

function label(interaction: LeadDetailInteraction): string {
  if (interaction.resend_email_id) {
    return interaction.type === 'email_received' ? 'Email recibido' : 'Email enviado'
  }
  return LABEL[interaction.type] ?? interaction.type
}

/**
 * The last valuable interactions (calls, emails, notes) for the summary tab:
 * the first thing a rep scans before dialing or writing. Resend lifecycle
 * events collapse into the single email they belong to, and when the full
 * activity tab holds more, a link points there.
 */
export function LeadRecentInteractions({
  leadId,
  leadEmail,
  canEdit,
  aiEnabled,
  interactions,
  limit = 5,
  totalActivityEvents,
}: LeadRecentInteractionsProps) {
  const recent = groupResendInteractions(interactions)
    .map(({ interaction, latestInteraction }) => ({ interaction, date: interactionDate(latestInteraction) }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)

  const hasMoreHistory =
    totalActivityEvents != null && totalActivityEvents > recent.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Últimas interacciones</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm font-normal">
            Llamadas, emails y notas más recientes con este lead.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">Sin interacciones todavía.</p>
        ) : (
          <>
            <ul className="divide-border divide-y">
              {recent.map(({ interaction, date }) => {
                const Icon = icon(interaction.type)
                const snippet = excerptInteractionBody(interaction.body, 140)
                return (
                  <li key={interaction.id} className="flex items-start gap-3 py-2.5">
                    <span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{label(interaction)}</p>
                      {interaction.subject ? (
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {interaction.subject}
                        </p>
                      ) : null}
                      {snippet ? (
                        <p className="text-muted-foreground/90 mt-1 line-clamp-2 text-xs leading-relaxed">
                          {snippet}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground flex shrink-0 flex-col items-end gap-1 text-xs">
                      <span className="tabular-nums">{relativeTime(date)}</span>
                      {interaction.type === 'call' ? (
                        <CallInteractionDetails
                          interaction={interaction}
                          leadId={leadId}
                          canEdit={canEdit}
                        />
                      ) : (
                        <LeadInteractionDetails
                          interaction={interaction}
                          label={label(interaction)}
                          leadId={leadId}
                          leadEmail={leadEmail}
                          canReply={canEdit}
                          aiEnabled={aiEnabled}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {hasMoreHistory ? (
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground mt-2 w-full">
                <Link href={`/leads/${leadId}?tab=actividad`}>
                  Ver todo el historial
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
