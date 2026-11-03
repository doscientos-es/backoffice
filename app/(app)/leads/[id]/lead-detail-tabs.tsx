import { BriefcaseBusiness, FileClock, House, Lightbulb } from 'lucide-react'
import Link from 'next/link'

import { TabCount, TabList, TabTrigger } from '@/components/ui/tabs'

const LEAD_TABS = ['resumen', 'actividad', 'comercial', 'inteligencia'] as const

export type LeadTab = (typeof LEAD_TABS)[number]

const LABEL: Record<LeadTab, { title: string; icon: typeof House }> = {
  resumen: { title: 'Resumen', icon: House },
  actividad: { title: 'Actividad', icon: FileClock },
  comercial: { title: 'Comercial', icon: BriefcaseBusiness },
  inteligencia: { title: 'Inteligencia', icon: Lightbulb },
}

/** Falls back to the summary tab for unknown or missing `?tab=` values. */
export function resolveLeadTab(value: string | undefined): LeadTab {
  return LEAD_TABS.includes(value as LeadTab) ? (value as LeadTab) : 'resumen'
}

function leadTabHref(leadId: string, tab: LeadTab): string {
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
    <TabList
      aria-label="Secciones del lead"
      className="grid w-full grid-cols-4 gap-1 p-1 sm:flex sm:w-auto sm:gap-0.5"
    >
      {LEAD_TABS.map((tab) => {
        const count = counts?.[tab]
        const Icon = LABEL[tab].icon
        return (
          <TabTrigger
            key={tab}
            asChild
            active={tab === current}
            className="group/tab min-h-11 justify-center gap-1.5 px-1.5 text-[11px] sm:min-h-9 sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Link
              href={leadTabHref(leadId, tab)}
              scroll={false}
              aria-current={tab === current ? 'page' : undefined}
            >
              <Icon className="size-3.5 shrink-0 sm:hidden" aria-hidden />
              <span className="truncate">{LABEL[tab].title}</span>
              {count ? <TabCount>{count}</TabCount> : null}
            </Link>
          </TabTrigger>
        )
      })}
    </TabList>
  )
}
