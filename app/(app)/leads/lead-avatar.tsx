'use client'

import { useState } from 'react'

import { EntityAvatar } from '@/components/ui/entity-avatar'
import { corporateDomainFromEmail, isCorporateDomain } from '@/lib/leads/company-domain'

export function LeadAvatar({
  name,
  email,
  company,
  researchedDomain,
  logoUrl,
  size = 'sm',
  className,
}: {
  name: string
  email: string | null | undefined
  company?: string | null
  researchedDomain?: string | null
  logoUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const candidate = (researchedDomain || company || '').trim().toLowerCase()
  const domain =
    corporateDomainFromEmail(email) ?? (isCorporateDomain(candidate) ? candidate : null)
  const iconUrl = domain ? `/api/leads/company-icon?domain=${encodeURIComponent(domain)}` : null
  const [failedSources, setFailedSources] = useState<string[]>([])
  const source = [logoUrl, iconUrl].find((url) => url && !failedSources.includes(url))
  if (!source) return <EntityAvatar name={name} size={size} className={className} />
  return (
    <span
      className="inline-flex shrink-0"
      onError={() => setFailedSources((failed) => [...failed, source])}
    >
      <EntityAvatar name={name} logoUrl={source} size={size} className={className} />
    </span>
  )
}
