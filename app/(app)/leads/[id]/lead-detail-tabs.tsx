'use client'

import { BriefcaseBusiness, FileClock, House, Lightbulb, ReceiptText } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import type { MouseEvent, ReactNode } from 'react'

import { TabCount, TabList, TabTrigger } from '@/components/ui/tabs'

const LEAD_TABS = ['resumen', 'actividad', 'comercial', 'facturacion', 'inteligencia'] as const

export type LeadTab = (typeof LEAD_TABS)[number]

const LABEL: Record<LeadTab, { title: string; icon: typeof House }> = {
  resumen: { title: 'Resumen', icon: House },
  actividad: { title: 'Actividad', icon: FileClock },
  comercial: { title: 'Comercial', icon: BriefcaseBusiness },
  facturacion: { title: 'Facturación', icon: ReceiptText },
  inteligencia: { title: 'Inteligencia', icon: Lightbulb },
}

/** Falls back to the summary tab for unknown or missing `?tab=` values. */
export function resolveLeadTab(value: string | undefined): LeadTab {
  return LEAD_TABS.includes(value as LeadTab) ? (value as LeadTab) : 'resumen'
}

function leadTabHref(leadId: string, tab: LeadTab): string {
  return tab === 'resumen' ? `/leads/${leadId}` : `/leads/${leadId}?tab=${tab}`
}

export function LeadTabLink({
  leadId,
  tab,
  children,
  ...props
}: {
  leadId: string
  tab: LeadTab
  children: ReactNode
} & Omit<React.ComponentProps<'a'>, 'href'>) {
  const href = leadTabHref(leadId, tab)

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    props.onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === '_blank'
    )
      return
    event.preventDefault()
    if (`${window.location.pathname}${window.location.search}` !== href) {
      window.history.pushState(null, '', href)
    }
  }

  return (
    <a {...props} href={href} onClick={navigate}>
      {children}
    </a>
  )
}

export function LeadTabPanel({ tab, children }: { tab: LeadTab; children: ReactNode }) {
  const current = resolveLeadTab(useSearchParams().get('tab') ?? undefined)
  return current === tab ? children : null
}

export function LeadDetailTabs({
  leadId,
  counts,
}: {
  leadId: string
  counts?: Partial<Record<LeadTab, number>>
}) {
  const current = resolveLeadTab(useSearchParams().get('tab') ?? undefined)
  return (
    <TabList
      aria-label="Secciones del lead"
      className="grid w-full grid-cols-3 gap-1 p-1 sm:flex sm:w-auto sm:gap-0.5"
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
            <LeadTabLink
              leadId={leadId}
              tab={tab}
              aria-current={tab === current ? 'page' : undefined}
            >
              <Icon className="size-3.5 shrink-0 sm:hidden" aria-hidden />
              <span className="truncate">{LABEL[tab].title}</span>
              {count ? <TabCount>{count}</TabCount> : null}
            </LeadTabLink>
          </TabTrigger>
        )
      })}
    </TabList>
  )
}
