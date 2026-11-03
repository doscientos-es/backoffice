import type { ReactNode } from 'react'

export default function ProposalPortalLayout({ children }: { children: ReactNode }) {
  return <div data-proposal-portal>{children}</div>
}
