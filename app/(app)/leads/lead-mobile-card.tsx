'use client'

import { ChevronRight, Mail, Phone } from 'lucide-react'

import { MemberLabel } from '@/components/ui/member-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import type { LeadListItem } from '@/lib/leads/types'
import { leadDisplayName } from '@/lib/leads/utils'
import { LEAD_STATUS } from '@/lib/status'
import { cn, relativeTime } from '@/lib/utils'

import { LeadCallLink } from './[id]/phone-actions'
import { LeadNextAction } from './lead-next-action'

export function LeadMobileCard({
  lead,
  onOpenAction,
}: {
  lead: LeadListItem
  onOpenAction: () => void
}) {
  const name = leadDisplayName(lead)
  const contactClass =
    'flex min-h-11 min-w-0 items-center gap-2 px-3 text-xs text-primary transition-colors hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset'

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <button
        type="button"
        onClick={onOpenAction}
        aria-label={`Abrir ficha rápida de ${name}`}
        className="flex min-h-18 w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          {lead.alias?.trim() && lead.alias.trim() !== lead.name ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{lead.name}</span>
          ) : null}
          {lead.company ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {lead.company}
            </span>
          ) : null}
          <span className="mt-2 inline-flex">
            <StatusBadge meta={LEAD_STATUS} value={lead.status} />
          </span>
        </span>
        <ChevronRight className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-col gap-2 px-3 pb-3">
        <LeadNextAction lead={lead} />
        <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
          {lead.assignee ? (
            <MemberLabel member={lead.assignee} size="sm" />
          ) : (
            <span>Sin responsable</span>
          )}
          <time dateTime={lead.created_at} className="shrink-0" title="Fecha de creación">
            {relativeTime(lead.created_at)}
          </time>
        </div>
      </div>
      {lead.phone || lead.email ? (
        <div
          className={cn(
            'grid divide-x divide-border/70 border-t border-border/70',
            lead.phone && lead.email ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          {lead.phone ? (
            <LeadCallLink
              leadId={lead.id}
              phone={lead.phone}
              aria-label={`Llamar a ${name}`}
              title={lead.phone}
              className={contactClass}
            >
              <Phone className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{lead.phone}</span>
            </LeadCallLink>
          ) : null}
          {lead.email ? (
            <a
              href={`mailto:${lead.email}`}
              aria-label={`Enviar email a ${name}`}
              title={lead.email}
              className={contactClass}
            >
              <Mail className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{lead.email}</span>
            </a>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">
          Sin teléfono ni email
        </p>
      )}
    </article>
  )
}
