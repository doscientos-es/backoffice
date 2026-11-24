import { CalendarPlus } from 'lucide-react'

import type { PortalLanguage } from '@/lib/portal/language'
import { proposalTr } from '@/lib/proposals/public-copy'
import {
  formatTimelineDate,
  timelineCalendarHref,
  timelineLayout,
  type TimelineItem,
} from '@/lib/proposals/timeline'

export function TimelineChart({
  items,
  allItems = items,
  proposalId,
  proposalTitle,
  language,
}: {
  items: TimelineItem[]
  allItems?: TimelineItem[]
  proposalId: string
  proposalTitle: string
  language: PortalLanguage
}) {
  const tr = proposalTr(language)
  const visible = new Set(items.map((item) => item.id))
  const rows = timelineLayout(allItems).filter(({ item }) => visible.has(item.id))
  if (!rows.length) return null
  return (
    <div className="w-full text-left">
      <div className="space-y-4">
        {rows.map(({ item, left, width }) => (
          <div key={item.id} className="rounded-xl border border-[#dce9d7] bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-1">
              <p className="text-sm font-semibold text-[#183017]">{item.title}</p>
              <p className="text-xs text-zinc-600">
                {formatTimelineDate(item.start_date, language)}
                {item.start_date !== item.end_date
                  ? ` – ${formatTimelineDate(item.end_date, language)}`
                  : ''}
              </p>
            </div>
            {item.description ? (
              <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-600">{item.description}</p>
            ) : null}
            <div className="mt-3 h-2.5 rounded-full bg-[#e9f1e6]" aria-hidden="true">
              <div
                className="h-full rounded-full bg-[#71b847]"
                style={{ marginLeft: `${left}%`, width: `${width}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <a
        href={timelineCalendarHref(allItems, proposalId, proposalTitle)}
        download="plazos-propuesta.ics"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#2A4227] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#385834] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A4227]"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {tr('Añadir a mi calendario', 'Afegir al meu calendari', 'Add to my calendar')}
      </a>
      <p className="mt-2 text-xs text-zinc-500">
        {tr(
          'Descarga todos los hitos como eventos de día completo.',
          'Descarrega totes les fites com a esdeveniments de dia complet.',
          'Download all milestones as all-day events.',
        )}
      </p>
    </div>
  )
}
