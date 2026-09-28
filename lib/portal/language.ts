export type PortalLanguage = 'es' | 'ca' | 'en'

export function resolvePortalLanguage(
  leadLanguage: unknown,
  linkLanguage?: unknown,
): PortalLanguage {
  if (linkLanguage === 'ca' || linkLanguage === 'en' || linkLanguage === 'es') {
    return linkLanguage
  }
  if (leadLanguage === 'ca' || leadLanguage === 'en' || leadLanguage === 'es') {
    return leadLanguage
  }
  return 'es'
}

export function formatPortalDate(value: string | null | undefined, language: PortalLanguage): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(`${language}-${language === 'en' ? 'GB' : 'ES'}`, {
    dateStyle: 'long',
  }).format(date)
}

export function formatPortalEUR(value: number, language: PortalLanguage): string {
  return new Intl.NumberFormat(`${language}-${language === 'en' ? 'GB' : 'ES'}`, {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}
