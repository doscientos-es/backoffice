'use client'

import { ArrowRight, Eye, MousePointerClick, Send } from 'lucide-react'
import Link from 'next/link'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'
import { MemberLabel } from '@/components/ui/member-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { getLeadInitials, leadDisplayName } from '@/lib/leads/utils'
import type { RecoveryLead } from '@/lib/recovery/types'
import { RECOVERY_STATE } from '@/lib/status'
import { formatEUR, relativeTime } from '@/lib/utils'

import { RecoveryActions } from './recovery-actions'

type RecoveryListProps = Omit<ListPageProps, 'rows'> & {
  leads: RecoveryLead[]
  aiEnabled?: boolean
}

function LeadInitials({ lead }: { lead: RecoveryLead }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary uppercase">
      {getLeadInitials(lead)}
    </span>
  )
}

function EngagementCell({ lead }: { lead: RecoveryLead }) {
  const lastSignal = lead.lastClickedAt ?? lead.lastOpenedAt ?? lead.lastContactedAt

  return (
    <div className="flex min-w-36 flex-col gap-1">
      <div className="flex items-center gap-2 text-xs tabular-nums">
        <span
          className="inline-flex items-center gap-1 text-foreground"
          title="Clics en enlaces trackeados"
        >
          <MousePointerClick className="size-3.5 text-primary" />
          {lead.clickCount}
        </span>
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Aperturas detectadas (aproximado)"
        >
          <Eye className="size-3.5" />
          {lead.openCount}
        </span>
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Emails, llamadas o reuniones de repesca"
        >
          <Send className="size-3.5" />
          {lead.outreachCount}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {lastSignal ? `Última señal ${relativeTime(lastSignal)}` : 'Sin actividad'}
      </span>
    </div>
  )
}

export function RecoveryList({ leads, aiEnabled = false, ...props }: RecoveryListProps) {
  const rows = leads.map((l) => ({
    id: l.id,

    cells: {
      nombre: {
        content: (
          <Link
            key="name"
            href={`/leads/${l.id}`}
            className="group/leadname inline-flex items-center gap-2.5"
          >
            <LeadInitials lead={l} />
            <span className="max-w-40 truncate font-medium underline-offset-2 transition-colors group-hover/leadname:text-primary group-hover/leadname:underline">
              {leadDisplayName(l)}
            </span>
            <ArrowRight className="size-3.5 shrink-0 -translate-x-1 opacity-0 transition-all group-hover/leadname:translate-x-0 group-hover/leadname:opacity-60" />
          </Link>
        ),
        value: leadDisplayName(l),
      },
      empresa: { content: l.company ?? '—', value: l.company ?? '' },
      motivo: {
        content: (
          <span key="reason" className="text-muted-foreground">
            {l.lost_reason ?? '—'}
          </span>
        ),
        value: l.lost_reason ?? '',
      },
      repesca: {
        content: <StatusBadge key="state" meta={RECOVERY_STATE} value={l.recoveryState} />,
        value: RECOVERY_STATE[l.recoveryState].label,
      },
      senales: {
        content: <EngagementCell key="engagement" lead={l} />,
        value: `clics:${l.clickCount} aperturas:${l.openCount} contactos:${l.outreachCount}`,
      },
      responsable: {
        content: <MemberLabel key="assignee" member={l.assignee} size="sm" />,
        value: l.assignee?.name ?? '',
      },
      perdido: {
        content: (
          <span key="lost" className="text-muted-foreground tabular-nums">
            {relativeTime(l.lost_at)}
          </span>
        ),
        value: l.lost_at ?? '',
      },
      valor: {
        content: (
          <span key="value" className="tabular-nums">
            {formatEUR(l.estimated_value)}
          </span>
        ),
        value: l.estimated_value?.toString() ?? '',
      },
      acciones: {
        content: <RecoveryActions key="actions" lead={l} aiEnabled={aiEnabled} />,
        value: '',
      },
    },
  }))

  return <ListPage {...props} rows={rows} />
}
