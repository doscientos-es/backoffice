import { CalendarPlus, ChevronDown } from 'lucide-react'

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
  const layout = timelineLayout(allItems)
  const rows = layout
    .map((row, index) => ({ ...row, index }))
    .filter(({ item }) => visible.has(item.id))
  if (!rows.length) return null
  const startDate = layout[0]?.item.start_date
  const endDate = allItems.reduce(
    (latest, item) => (item.end_date > latest ? item.end_date : latest),
    '',
  )
  return (
    <div className="w-full text-left">
      <div className="overflow-hidden rounded-2xl border border-[#dce9d7] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#f4f8f2] px-4 py-3 sm:px-5">
          <p className="text-xs font-semibold tracking-wide text-[#2A4227]">
            {allItems.length}{' '}
            {allItems.length === 1
              ? tr('hito', 'fita', 'milestone')
              : tr('hitos', 'fites', 'milestones')}
          </p>
          {startDate && (
            <p className="text-xs text-zinc-600">
              {formatTimelineDate(startDate, language)}
              {startDate !== endDate ? ` – ${formatTimelineDate(endDate, language)}` : ''}
            </p>
          )}
        </div>
        <ol className="divide-y divide-[#edf2eb]">
          {rows.map(({ item, left, width, index }) => {
            const row = (
              <>
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf5e9] text-xs font-bold text-[#2A4227]"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#183017]">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-600">
                    {formatTimelineDate(item.start_date, language)}
                    {item.start_date !== item.end_date
                      ? ` – ${formatTimelineDate(item.end_date, language)}`
                      : ''}
                  </span>
                  <span
                    className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[#e9f1e6] sm:hidden"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-[#71b847]"
                      style={{ marginLeft: `${left}%`, width: `${width}%` }}
                    />
                  </span>
                </span>
                <span
                  className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#e9f1e6] sm:block"
                  aria-hidden="true"
                >
                  <span
                    className="block h-full rounded-full bg-[#71b847]"
                    style={{ marginLeft: `${left}%`, width: `${width}%` }}
                  />
                </span>
                {item.description.trim() && (
                  <ChevronDown
                    className="size-4 shrink-0 text-[#66825f] transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                )}
              </>
            )
            return (
              <li key={item.id}>
                {item.description.trim() ? (
                  <>
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f8fbf7] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#2A4227] motion-reduce:transition-none sm:px-5 [&::-webkit-details-marker]:hidden">
                        {row}
                      </summary>
                      <p className="px-4 pb-4 pl-15 text-sm break-words whitespace-pre-wrap text-zinc-600 sm:px-5 sm:pl-16 print:hidden">
                        {item.description}
                      </p>
                    </details>
                    <p className="hidden px-4 pb-4 pl-15 text-sm break-words whitespace-pre-wrap text-zinc-600 sm:px-5 sm:pl-16 print:block">
                      {item.description}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">{row}</div>
                )}
              </li>
            )
          })}
        </ol>
      </div>
      <a
        href={timelineCalendarHref(allItems, proposalId, proposalTitle)}
        download="plazos-propuesta.ics"
        title={tr(
          'Descarga todos los hitos como eventos de día completo.',
          'Descarrega totes les fites com a esdeveniments de dia complet.',
          'Download all milestones as all-day events.',
        )}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#dce9d7] bg-white px-4 py-2 text-sm font-semibold text-[#2A4227] transition-colors hover:bg-[#f4f8f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2A4227] motion-reduce:transition-none"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {tr('Añadir a mi calendario', 'Afegir al meu calendari', 'Add to my calendar')}
      </a>
    </div>
  )
}
