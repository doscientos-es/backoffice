'use client'

import { Calendar, ChevronDown, Mail, Phone, StickyNote } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { LeadDetailInteraction } from '@/lib/leads/types'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'

import { CallInteractionDetails, CallInteractionWarning } from './call-interaction-details'
import { LeadInteractionDetails } from './lead-interaction-details'

export type TimelineItem = {
  interaction: LeadDetailInteraction
  date: string
  label: string
  snippet: string | null
}

const KIND: Record<string, { icon: typeof Mail; tone: string }> = {
  call: { icon: Phone, tone: 'bg-primary/10 text-primary' },
  meeting: { icon: Calendar, tone: 'bg-success/10 text-success' },
  note: { icon: StickyNote, tone: 'bg-warning/10 text-warning' },
}
const EMAIL_KIND = { icon: Mail, tone: 'bg-info/10 text-info' }

type Props = {
  items: TimelineItem[]
  initialCount: number
  step: number
  leadId: string
  leadEmail: string | null
  leadLanguage?: string | null
  canEdit: boolean
  aiEnabled: boolean
}

/** Vertical timeline of interactions with an in-place "load more" control. */
export function LeadInteractionTimeline({
  items,
  initialCount,
  step,
  leadId,
  leadEmail,
  leadLanguage,
  canEdit,
  aiEnabled,
}: Props) {
  const [visible, setVisible] = useState(initialCount)
  const shown = items.slice(0, visible)
  const remaining = items.length - shown.length

  return (
    <>
      <ol className="relative flex flex-col">
        {shown.map(({ interaction, date, label, snippet }, index) => {
          const { icon: Icon, tone } = KIND[interaction.type] ?? EMAIL_KIND
          const isLast = index === shown.length - 1
          return (
            <li key={interaction.id} className="relative flex gap-3 pb-5 last:pb-0">
              {isLast ? null : (
                <span
                  aria-hidden
                  className="absolute top-9 bottom-0 left-4 w-px -translate-x-1/2 bg-border"
                />
              )}
              <span
                className={cn(
                  'z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                  tone,
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold">{label}</p>
                  <time
                    dateTime={date}
                    title={formatDateTime(date)}
                    className="shrink-0 text-xs text-muted-foreground tabular-nums"
                  >
                    {relativeTime(date)}
                  </time>
                </div>
                {interaction.subject ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                    {interaction.subject}
                  </p>
                ) : null}
                {snippet ? (
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground/90">
                    {snippet}
                  </p>
                ) : null}
                {interaction.type === 'call' ? (
                  <CallInteractionWarning interaction={interaction} />
                ) : null}
                <div className="mt-2 flex justify-end">
                  {interaction.type === 'call' ? (
                    <CallInteractionDetails
                      interaction={interaction}
                      leadId={leadId}
                      canEdit={canEdit}
                    />
                  ) : (
                    <LeadInteractionDetails
                      interaction={interaction}
                      label={label}
                      leadId={leadId}
                      leadEmail={leadEmail}
                      leadLanguage={leadLanguage}
                      canReply={canEdit}
                      aiEnabled={aiEnabled}
                    />
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {remaining > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={() => setVisible((count) => count + step)}
        >
          <ChevronDown className="size-3.5" aria-hidden />
          Cargar más ({Math.min(step, remaining)} de {remaining})
        </Button>
      ) : null}
    </>
  )
}
