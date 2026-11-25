const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'outlook.es',
  'live.com',
  'live.es',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'telefonica.net',
  'orange.es',
  'wanadoo.es',
  'gmil.com',
])

export function isCorporateDomain(domain: string): boolean {
  if (domain.length > 253 || domain !== domain.toLowerCase()) return false
  const labels = domain.split('.')
  return (
    labels.length >= 2 &&
    /^[a-z]{2,63}$/.test(labels.at(-1) ?? '') &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    ![...PERSONAL_EMAIL_DOMAINS, 'onmicrosoft.com'].some(
      (provider) => domain === provider || domain.endsWith(`.${provider}`),
    )
  )
}

export function corporateDomainFromEmail(email: string | null | undefined): string | null {
  const parts = email?.trim().toLowerCase().split('@') ?? []
  if (parts.length !== 2 || !parts[0] || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0]))
    return null
  const domain = parts[1]?.replace(/\.$/, '') ?? ''
  return isCorporateDomain(domain) ? domain : null
}
