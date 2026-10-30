import { Mail } from 'lucide-react'

import type { Tr } from '../_lib/i18n'

export type ProposalContact = {
  name: string
  email: string | null
  avatar_url: string | null
}

/** Puts a person behind the proposal: who wrote it and how to reach them. */
export function ContactCard({
  contact,
  proposalNumber,
  tr,
}: {
  contact: ProposalContact
  proposalNumber: string
  tr: Tr
}) {
  const subject = encodeURIComponent(`${tr('Propuesta', 'Proposta', 'Proposal')} ${proposalNumber}`)
  const initial = contact.name.trim().charAt(0).toUpperCase()
  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50 px-6 py-6 sm:flex-row sm:items-center sm:px-8 dark:border-zinc-800 dark:bg-zinc-900/50">
      {contact.avatar_url ? (
        // biome-ignore lint/performance/noImgElement: avatar externo del equipo, no compatible con next/image
        <img
          src={contact.avatar_url}
          alt=""
          className="size-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#2A4227] text-base font-bold text-white dark:bg-[#9CC196] dark:text-zinc-900"
        >
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {tr(
            `¿Dudas? Habla con ${contact.name}`,
            `Dubtes? Parla amb ${contact.name}`,
            `Questions? Talk to ${contact.name}`,
          )}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          {tr(
            'Ha preparado esta propuesta y te responde directamente. También puedes usar el chat de esta página.',
            'Ha preparat aquesta proposta i et respon directament. També pots fer servir el xat d’aquesta pàgina.',
            'They prepared this proposal and will reply directly. You can also use the chat on this page.',
          )}
        </p>
      </div>
      {contact.email ? (
        <a
          href={`mailto:${contact.email}?subject=${subject}`}
          className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-[#2A4227] transition-colors hover:border-[#2A4227] hover:bg-[#2A4227]/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-[#9CC196] dark:hover:border-[#9CC196]"
        >
          <Mail aria-hidden className="size-3.5" />
          {tr('Escribir por email', 'Escriure per correu', 'Send an email')}
        </a>
      ) : null}
    </div>
  )
}
