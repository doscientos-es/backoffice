import { Flame } from 'lucide-react'

import { cn, relativeTime } from '@/lib/utils'

type HeatLead = {
  temperature?: 'hot' | 'warm' | 'cold' | null
  engagement_score?: number | null
  last_engaged_at?: string | null
}

/** Interest shown in a public proposal in the last 14 days, from `engagement_score`. */
export function leadHeatTitle(lead: HeatLead): string | null {
  const score = lead.engagement_score ?? 0
  if (score <= 0) return null
  const when = lead.last_engaged_at
    ? ` · última actividad ${relativeTime(lead.last_engaged_at)}`
    : ''
  return `Interés en la propuesta: ${score}/100${when}`
}

/**
 * Flame shown only when the lead has recently engaged with a proposal and is
 * hot or warm. Leads with no recent activity render nothing, so it stays a signal.
 */
export function LeadHeatBadge({ lead, className }: { lead: HeatLead; className?: string }) {
  const title = leadHeatTitle(lead)
  if (!title || (lead.temperature !== 'hot' && lead.temperature !== 'warm')) return null
  const hot = lead.temperature === 'hot'
  return (
    <span
      title={title}
      role="img"
      aria-label={hot ? `Lead caliente. ${title}` : `Lead templado. ${title}`}
      className={cn(
        'inline-flex h-4 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-semibold',
        hot
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
        className,
      )}
    >
      <Flame aria-hidden className="size-3" />
      {lead.engagement_score}
    </span>
  )
}
