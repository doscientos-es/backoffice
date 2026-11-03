import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  excerptInteractionBody,
  groupResendInteractions,
  interactionDate,
} from '@/lib/leads/interaction-utils'
import type { LeadDetailInteraction } from '@/lib/leads/types'

import { QCallDialog, QEmailDialog, QNoteDialog } from '../lead-quick-action-dialogs'
import { LeadInteractionTimeline, type TimelineItem } from './lead-interaction-timeline'

const LABEL: Record<string, string> = {
  email_sent: 'Email enviado',
  email_received: 'Email recibido',
  call: 'Llamada',
  meeting: 'Reunión',
  note: 'Nota',
}

type LeadRecentInteractionsProps = {
  leadId: string
  leadName: string
  leadEmail: string | null
  leadPhone: string | null
  leadLanguage?: string | null
  senderName: string
  canEdit: boolean
  aiEnabled: boolean
  defaultDurationMinutes: number | null
  interactions: LeadDetailInteraction[]
  /** How many interactions to show before linking to the full activity tab. */
  limit?: number
  /** Total events available in the full activity tab, to show the history link. */
  totalActivityEvents?: number
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
  leadName,
  leadEmail,
  leadPhone,
  leadLanguage,
  senderName,
  canEdit,
  aiEnabled,
  defaultDurationMinutes,
  interactions,
  limit = 5,
  totalActivityEvents,
}: LeadRecentInteractionsProps) {
  const items: TimelineItem[] = groupResendInteractions(interactions)
    .map(({ interaction, latestInteraction }) => ({
      interaction,
      date: interactionDate(latestInteraction),
      label: label(interaction),
      snippet: excerptInteractionBody(interaction.body, 220),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const showHistoryLink = totalActivityEvents != null && totalActivityEvents > 0

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-3">
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Últimas interacciones</CardTitle>
            <p className="mt-1 text-sm font-normal text-muted-foreground">
              Llamadas, emails y notas más recientes con este lead.
            </p>
          </div>
          {showHistoryLink ? (
            <Button asChild variant="ghost" size="sm" className="shrink-0 text-muted-foreground">
              <Link href={`/leads/${leadId}?tab=actividad`}>
                Ver todo
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : null}
        </div>
        {canEdit ? (
          <fieldset
            aria-label="Acciones rápidas"
            className="flex min-w-0 flex-wrap items-center gap-1.5 [&_button]:w-auto"
          >
            <QNoteDialog leadId={leadId} />
            <QCallDialog
              leadId={leadId}
              leadName={leadName}
              leadPhone={leadPhone}
              leadEmail={leadEmail}
              leadLanguage={leadLanguage}
              senderName={senderName}
              aiEnabled={aiEnabled}
              defaultDurationMinutes={defaultDurationMinutes}
            />
            <QEmailDialog leadId={leadId} leadEmail={leadEmail} />
          </fieldset>
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin interacciones todavía.</p>
        ) : (
          <LeadInteractionTimeline
            items={items}
            initialCount={limit}
            step={limit}
            leadId={leadId}
            leadEmail={leadEmail}
            leadLanguage={leadLanguage}
            canEdit={canEdit}
            aiEnabled={aiEnabled}
          />
        )}
      </CardContent>
    </Card>
  )
}
