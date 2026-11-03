import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'

import type { Tr } from '../_lib/i18n'
import { TrackedLink } from './respond-controls'

import styles from './whatsapp-widget.module.css'

export function ProposalWhatsAppWidget({
  token,
  proposalNumber,
  proposalUrl,
  phone,
  hasMobileCta,
  tr,
}: {
  token: string
  proposalNumber: string
  proposalUrl: string
  phone: string
  hasMobileCta: boolean
  tr: Tr
}) {
  const message = `${tr(
    `Hola, tengo una duda sobre la propuesta ${proposalNumber}`,
    `Hola, tinc un dubte sobre la proposta ${proposalNumber}`,
    `Hi, I have a question about proposal ${proposalNumber}`,
  )}\n\n${proposalUrl}`
  return (
    <TrackedLink
      token={token}
      type="whatsapp_click"
      href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.floating} ${hasMobileCta ? styles.withMobileCta : ''} inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full bg-zinc-950 py-2 pr-5 pl-2 text-left text-white shadow-lg hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950`}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#BDFF7B] text-zinc-950"
      >
        <WhatsAppIcon size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-semibold">
          {tr('¿Tienes dudas?', 'Tens dubtes?', 'Questions?')}
        </span>
        <span className="block text-xs leading-tight text-zinc-300">
          {tr('Escríbenos por WhatsApp', 'Escriu-nos per WhatsApp', 'Message us on WhatsApp')}
        </span>
      </span>
    </TrackedLink>
  )
}
