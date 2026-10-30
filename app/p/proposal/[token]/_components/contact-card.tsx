import { Mail } from 'lucide-react'

import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'

import type { Tr } from '../_lib/i18n'
import { TrackedLink } from './respond-controls'

export type ProposalContact = {
  name: string
  email: string | null
  avatar_url: string | null
}

/** Company WhatsApp line, same default the landing's WhatsApp redirect uses. */
const COMPANY_WHATSAPP_PHONE = '34671171525'

/** Puts a person behind the proposal: who wrote it and how to reach them. */
export function ContactCard({
  token,
  contact,
  proposalNumber,
  tr,
}: {
  token: string
  /** Null when the author is unknown: the card falls back to a generic "write to us". */
  contact: ProposalContact | null
  proposalNumber: string
  tr: Tr
}) {
  const subject = encodeURIComponent(`${tr('Propuesta', 'Proposta', 'Proposal')} ${proposalNumber}`)
  const whatsappText = encodeURIComponent(
    tr(
      `Hola, tengo una duda sobre la propuesta ${proposalNumber}`,
      `Hola, tinc un dubte sobre la proposta ${proposalNumber}`,
      `Hi, I have a question about proposal ${proposalNumber}`,
    ),
  )
  const name = contact?.name ?? ''
  const initial = name.trim().charAt(0).toUpperCase() || '·'
  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50 px-6 py-6 sm:flex-row sm:items-center sm:px-8 dark:border-zinc-800 dark:bg-zinc-900/50">
      {contact?.avatar_url ? (
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
          {contact
            ? tr(
                `¿Dudas? Habla con ${name}`,
                `Dubtes? Parla amb ${name}`,
                `Questions? Talk to ${name}`,
              )
            : tr('¿Dudas? Escríbenos', 'Dubtes? Escriu-nos', 'Questions? Write to us')}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          {tr(
            'Te respondemos directamente. Si prefieres dejarlo por escrito, también puedes usar “Consultas” en esta página.',
            'Et responem directament. Si prefereixes deixar-ho per escrit, també pots fer servir “Consultes” en aquesta pàgina.',
            'We reply directly. If you prefer to put it in writing, you can also use “Questions” on this page.',
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <TrackedLink
          token={token}
          type="whatsapp_click"
          href={`https://wa.me/${COMPANY_WHATSAPP_PHONE}?text=${whatsappText}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1FA855] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#188a45] focus-visible:ring-2 focus-visible:ring-[#1FA855] focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <WhatsAppIcon size={14} />
          {tr('Preguntar por WhatsApp', 'Preguntar per WhatsApp', 'Ask on WhatsApp')}
        </TrackedLink>
        {contact?.email ? (
          <a
            href={`mailto:${contact.email}?subject=${subject}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-[#2A4227] transition-colors hover:border-[#2A4227] hover:bg-[#2A4227]/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-[#9CC196] dark:hover:border-[#9CC196]"
          >
            <Mail aria-hidden className="size-3.5" />
            {tr('Email', 'Correu', 'Email')}
          </a>
        ) : null}
      </div>
    </div>
  )
}
