'use client'

import type { ReactNode } from 'react'

import { LeadCallLink } from '../leads/[id]/phone-actions'

/**
 * Turns a "call them" hint into the same call action as the lead page: on a
 * desktop it opens the QR to continue the call from the phone, on a phone it
 * dials. The wrapper stops the click from also opening the surrounding table row.
 */
export function ProposalCallChip({
  leadId,
  phone,
  className,
  title,
  children,
}: {
  leadId: string
  phone: string
  className?: string
  title?: string
  children: ReactNode
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops click propagation to the parent row
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <LeadCallLink
        leadId={leadId}
        phone={phone}
        title={title}
        aria-label="Llamar al cliente"
        className={className}
      >
        {children}
      </LeadCallLink>
    </span>
  )
}
