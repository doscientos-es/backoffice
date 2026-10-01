'use client'

import { ArrowRight, Bell, CheckCircle2, ListTodo, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { ListPage, type ListPageProps } from '@/components/layout/list-page'
import { MemberLabel } from '@/components/ui/member-avatar'
import { StatusBadge } from '@/components/ui/status-badge'
import { requiresCyaProspectSoftwareCommission } from '@/lib/leads/attribution'
import type { LeadListItem } from '@/lib/leads/types'
import { getLeadInitials, leadDisplayName } from '@/lib/leads/utils'
import type { MemberOption } from '@/lib/members/queries'
import { LEAD_STATUS } from '@/lib/status'
import { relativeTime } from '@/lib/utils'

import {
  bulkAssignLeadsToMe,
  bulkCreateLeadTasks,
  bulkScheduleLeadReminders,
  bulkUpdateLeadStatus,
} from './actions'
import { LeadFastActions } from './lead-fast-actions'
import { LeadQuickView } from './lead-quick-view'
import type { KanbanLead } from './leads-kanban'

type LeadsListProps = Omit<ListPageProps<KanbanLead>, 'rows'> & {
  leads: LeadListItem[]
  aiEnabled?: boolean
  canEdit?: boolean
  members?: MemberOption[]
  senderName?: string
}

function LeadInitials({ lead }: { lead: KanbanLead }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary uppercase">
      {getLeadInitials(lead)}
    </span>
  )
}

export function LeadsList({
  leads,
  aiEnabled = false,
  canEdit = false,
  members = [],
  senderName = '',
  ...props
}: LeadsListProps) {
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null)

  const rows = leads.map((l) => ({
    id: l.id,
    data: l,

    cells: {
      nombre: {
        content: (
          <Link
            key="name"
            href={`/leads/${l.id}`}
            className="group/leadname inline-flex items-center gap-2.5"
            onClick={(e) => e.stopPropagation()}
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
      empresa: { content: l.company, value: l.company ?? '' },
      email: {
        content: l.email ? (
          <a
            key="email"
            href={`mailto:${l.email}`}
            className="transition-colors hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {l.email}
          </a>
        ) : null,
        value: l.email ?? '',
      },
      campana: {
        content: (
          <div key="campaign" className="flex min-w-32 flex-col gap-0.5">
            <span className="truncate" title={l.marketing_campaign_name ?? undefined}>
              {l.marketing_campaign_name ?? '—'}
            </span>
            {requiresCyaProspectSoftwareCommission(l.marketing_campaign_name) && (
              <span className="text-[11px] font-medium text-warning">Comisión CYA · 20 %</span>
            )}
          </div>
        ),
        value: l.marketing_campaign_name ?? '',
      },
      estado: {
        content: (
          <div key="status" className="flex flex-col gap-0.5">
            <StatusBadge meta={LEAD_STATUS} value={l.status} />
            {(l.status === 'lost' || l.status === 'not_interested') && l.lost_reason && (
              <span className="max-w-36 truncate text-[11px] text-destructive/80">
                {l.lost_reason}
              </span>
            )}
          </div>
        ),
        value: l.status,
      },
      score: {
        content: (
          <span key="score" className="text-muted-foreground tabular-nums">
            {l.score ?? '—'}
          </span>
        ),
        value: l.score ?? '',
      },
      responsable: {
        content: <MemberLabel key="assignee" member={l.assignee} size="sm" />,
        value: l.assignee?.name ?? '',
      },
      creado: {
        content: (
          <span key="created" className="tabular-nums">
            {relativeTime(l.created_at)}
          </span>
        ),
        value: l.created_at,
      },
      acciones: {
        content: (
          // biome-ignore lint/a11y/noStaticElementInteractions: wrapper stops row navigation around its own interactive controls
          <div key="actions" className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <LeadFastActions lead={l} aiEnabled={aiEnabled} senderName={senderName} />
          </div>
        ),
        value: '',
      },
    },
  }))

  return (
    <>
      <ListPage
        {...props}
        rows={rows}
        bulkActions={[
          {
            label: 'Asignarme',
            icon: UserRound,
            onAction: async (ids) => {
              const result = await bulkAssignLeadsToMe({ ids })
              if (!result.ok) throw new Error(result.error)
            },
          },
          {
            label: 'Crear seguimiento',
            icon: ListTodo,
            onAction: async (ids) => {
              const result = await bulkCreateLeadTasks({ ids })
              if (!result.ok) throw new Error(result.error)
            },
          },
          {
            label: 'Recordatorio mañana',
            icon: Bell,
            onAction: async (ids) => {
              const result = await bulkScheduleLeadReminders({ ids })
              if (!result.ok) throw new Error(result.error)
            },
          },
          ...(['contacted', 'in_conversation', 'quoted', 'won', 'lost'] as const).map((status) => ({
            label: `Estado: ${LEAD_STATUS[status].label}`,
            icon: status === 'won' ? CheckCircle2 : undefined,
            onAction: async (ids: string[]) => {
              const result = await bulkUpdateLeadStatus({ ids, status })
              if (!result.ok) throw new Error(result.error)
            },
          })),
        ]}
        onRowClick={(row) => setSelectedLead(row.data ?? null)}
      />
      <LeadQuickView
        lead={selectedLead}
        canEdit={canEdit}
        aiEnabled={aiEnabled}
        members={members}
        senderName={senderName}
        onCloseAction={() => setSelectedLead(null)}
      />
    </>
  )
}
