import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'

import type { Tr } from '../_lib/i18n'
import { TrackedLink } from './respond-controls'

import styles from './whatsapp-widget.module.css'

export function ProposalWhatsAppWidget({
  token,
  proposalNumber,
  phone,
  hasMobileCta,
  tr,
}: {
  token: string
  proposalNumber: string
  phone: string
  hasMobileCta: boolean
  tr: Tr
}) {
  const message = tr(
    `Hola, tengo una duda sobre la propuesta ${proposalNumber}`,
    `Hola, tinc un dubte sobre la proposta ${proposalNumber}`,
    `Hi, I have a question about proposal ${proposalNumber}`,
  )
  return (
    <TrackedLink
      token={token}
      type="whatsapp_click"
      href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${styles.floating} ${hasMobileCta ? styles.withMobileCta : ''} inline-flex size-14 items-center justify-center rounded-full bg-[#BDFF7B] text-zinc-950 shadow-lg hover:bg-[#a9ef65] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950`}
    >
      <span aria-hidden>
        <WhatsAppIcon size={26} />
      </span>
      <span className="sr-only">
        {tr('Escribir por WhatsApp', 'Escriure per WhatsApp', 'Message on WhatsApp')}
      </span>
    </TrackedLink>
  )
}
