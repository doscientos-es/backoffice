import { Presentation } from 'lucide-react'

import { type PortalLanguage, makeTr } from '../_lib/i18n'

function PresentationLink({ token, language }: { token: string; language: PortalLanguage }) {
  const tr = makeTr(language)
  return (
    <a
      href={`/deck/${token}?lang=${language}`}
      className="flex items-center gap-3 rounded-2xl p-4 text-zinc-950 hover:bg-[#BDFF7B]/15 dark:text-white"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#BDFF7B] text-zinc-950">
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
      <span className="shrink-0 text-xs font-semibold">
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
    <section className={className}>
      <PresentationLink token={token} language={language} />
    </section>
  )
}
