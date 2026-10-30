import { Presentation } from 'lucide-react'

import { type PortalLanguage, makeTr } from '../_lib/i18n'
import { SectionLabel } from './primitives'

function PresentationLink({ token, language }: { token: string; language: PortalLanguage }) {
  const tr = makeTr(language)
  return (
    <a
      href={`/deck/${token}?lang=${language}`}
      className="group flex items-center gap-3 rounded-lg border border-[#2A4227]/20 bg-[#2A4227]/3 p-3 text-zinc-900 transition-colors hover:border-[#2A4227]/50 hover:bg-[#2A4227]/[0.07] dark:border-[#9CC196]/25 dark:bg-[#9CC196]/5 dark:text-zinc-100 dark:hover:border-[#9CC196]/60 dark:hover:bg-[#9CC196]/10"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-[#2A4227] shadow-sm ring-1 ring-[#2A4227]/10 dark:bg-zinc-900 dark:text-[#9CC196] dark:ring-[#9CC196]/15">
        <Presentation className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {tr('Presentación del proyecto', 'Presentació del projecte', 'Project presentation')}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">
          {tr(
            'Recorre la propuesta en formato visual',
            'Consulta la proposta en format visual',
            'Explore the proposal in a visual format',
          )}
        </span>
      </span>
      <span className="shrink-0 text-xs font-semibold text-[#2A4227] transition-transform group-hover:translate-x-0.5 dark:text-[#9CC196]">
        {tr('Abrir', 'Obrir', 'Open')} <span aria-hidden>→</span>
      </span>
    </a>
  )
}

/**
 * Card linking to the visual deck. Only offered in Spanish for now (the deck
 * has no other translations). `className` controls where it is visible.
 */
export function PresentationCard({
  token,
  language,
  className = '',
}: {
  token: string
  language: PortalLanguage
  className?: string
}) {
  if (language !== 'es') return null
  return (
    <section
      className={`rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800 ${className}`}
    >
      <SectionLabel as="p" className="mb-3">
        Presentación
      </SectionLabel>
      <PresentationLink token={token} language={language} />
    </section>
  )
}
