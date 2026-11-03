import type { ReactNode } from 'react'

import { Markdown } from '@/components/ui/markdown'
import type { KeyPoint } from '@/lib/proposals/key-points'

import { PROPOSAL_SURFACE_CLASS, SectionLabel } from './_components/primitives'

/**
 * Portal-side rendering primitives for the proposal narrative
 * (Context / Problems / Solutions). Co-located with the portal page
 * because their styling is tightly coupled to the surrounding document
 * shell and not reused on the deck or in the editor.
 */

export function PortalNarrativeBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className={`${PROPOSAL_SURFACE_CLASS} px-6 py-10 sm:px-10`}>
      <SectionLabel className="mb-6 text-center">{label}</SectionLabel>
      {children}
    </section>
  )
}

export function PortalKeyPointsList({
  items,
  variant,
}: {
  items: KeyPoint[]
  /**
   * Visual treatment differs by block so the two ordered lists in the
   * portal don't feel repetitive when displayed back-to-back.
   */
  variant: 'problems' | 'solutions'
}) {
  const isProblems = variant === 'problems'
  const badgeClass = isProblems
    ? 'bg-white text-zinc-950 ring-1 ring-inset ring-[#BDFF7B] dark:bg-zinc-950 dark:text-white'
    : 'bg-[#BDFF7B] text-zinc-950'
  return (
    <ol className="flex flex-col gap-6">
      {items.map((kp, i) => (
        <li key={kp.id} className="flex gap-4">
          <span
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${badgeClass}`}
            aria-hidden
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm leading-snug font-semibold text-zinc-900 dark:text-zinc-100">
              {kp.title}
            </p>
            {kp.description ? (
              <Markdown
                source={kp.description}
                className="gap-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
              />
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  )
}
