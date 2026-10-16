import { CalendarDays, CalendarPlus, Hourglass } from 'lucide-react'

import { nextActionForKanban } from '@/lib/leads/kanban-policy'
import { nextActionState, waitingForReplySince } from '@/lib/leads/pipeline'
import type { LeadListItem } from '@/lib/leads/types'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'

/** The same commercial next step in the board, desktop table and mobile cards. */
export function LeadNextAction({ lead, className }: { lead: LeadListItem; className?: string }) {
  const next = nextActionForKanban(lead)
  const state = nextActionState(lead.status, next)
  if (state === 'none') return null

  const waitingSince = waitingForReplySince(lead.recent_interactions)
  const waiting =
    waitingSince && state !== 'overdue' ? (
      <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <Hourglass className="size-3 shrink-0" aria-hidden />
        <span className="truncate">Esperando respuesta {relativeTime(waitingSince)}</span>
      </span>
    ) : null

  if (state === 'missing') {
    return (
      <div className={cn('flex min-w-0 flex-col gap-1', className)}>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
          <CalendarPlus className="size-3 shrink-0" aria-hidden />
          Sin próxima acción
        </span>
        {waiting}
      </div>
    )
  }

  if (!next) return null
  const tone =
    state === 'overdue'
      ? 'font-medium text-destructive'
      : state === 'today'
        ? 'font-medium text-warning'
        : 'text-muted-foreground'
  const dueDate = formatDateTime(next.remind_at)

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span
        className={cn('inline-flex min-w-0 items-center gap-1 text-xs', tone)}
        title={`${next.title} · ${dueDate}`}
      >
        <CalendarDays className="size-3 shrink-0" aria-hidden />
        <span className="truncate">
          {state === 'overdue' ? 'Vencido · ' : state === 'today' ? 'Hoy · ' : ''}
          <time dateTime={next.remind_at}>{relativeTime(next.remind_at)}</time> · {next.title}
        </span>
      </span>
      {waiting}
    </div>
  )
}
