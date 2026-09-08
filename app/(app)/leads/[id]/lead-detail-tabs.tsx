import Link from 'next/link'

import { TabCount, TabList, TabTrigger } from '@/components/ui/tabs'

export const LEAD_TABS = ['resumen', 'actividad', 'comercial', 'inteligencia'] as const

export type LeadTab = (typeof LEAD_TABS)[number]

const LABEL: Record<LeadTab, string> = {
  resumen: 'Resumen',
  actividad: 'Actividad',
  comercial: 'Comercial',
  inteligencia: 'Inteligencia',
}

/** Falls back to the summary tab for unknown or missing `?tab=` values. */
export function resolveLeadTab(value: string | undefined): LeadTab {
  return LEAD_TABS.includes(value as LeadTab) ? (value as LeadTab) : 'resumen'
}

export function leadTabHref(leadId: string, tab: LeadTab): string {
  return tab === 'resumen' ? `/leads/${leadId}` : `/leads/${leadId}?tab=${tab}`
}

export function LeadDetailTabs({
  leadId,
  current,
  counts,
}: {
  leadId: string
  current: LeadTab
  counts?: Partial<Record<LeadTab, number>>
}) {
  return (
    <TabList aria-label="Secciones del lead">
      {LEAD_TABS.map((tab) => {
        const count = counts?.[tab]
        return (
          <TabTrigger key={tab} asChild active={tab === current} className="group/tab">
            <Link href={leadTabHref(leadId, tab)} scroll={false}>
              {LABEL[tab]}
              {count ? <TabCount>{count}</TabCount> : null}
            </Link>
          </TabTrigger>
        )
      })}
    </TabList>
  )
}
