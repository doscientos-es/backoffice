import { ArrowUpRight, MonitorPlay } from 'lucide-react'

import { isProposalDemoUrl } from '@/lib/proposals/demo-url'

import type { Tr } from '../_lib/i18n'

export function DemoLink({ url, tr }: { url: string | null; tr: Tr }) {
  if (!url || !isProposalDemoUrl(url)) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-2xl bg-[#dfffc2] p-5 text-zinc-950 transition-colors hover:bg-[#BDFF7B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white">
        <MonitorPlay className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{tr('Ver demo', 'Veure demo', 'View demo')}</span>
        <span className="mt-0.5 block text-sm text-zinc-700">
          {tr('Ábrela en una nueva pestaña', 'Obre-la en una pestanya nova', 'Opens in a new tab')}
        </span>
      </span>
      <ArrowUpRight className="size-5 shrink-0" aria-hidden />
    </a>
  )
}
