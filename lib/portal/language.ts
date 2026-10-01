export type PortalLanguage = 'es' | 'ca' | 'en'

const dateFormatters: Partial<Record<PortalLanguage, Intl.DateTimeFormat>> = {}
const eurFormatters: Partial<Record<PortalLanguage, Intl.NumberFormat>> = {}

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

export function formatPortalDate(
  value: string | null | undefined,
  language: PortalLanguage,
): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  dateFormatters[language] ??= new Intl.DateTimeFormat(
    `${language}-${language === 'en' ? 'GB' : 'ES'}`,
    {
      dateStyle: 'long',
    },
  )
  return dateFormatters[language].format(date)
}

export function formatPortalEUR(value: number, language: PortalLanguage): string {
  eurFormatters[language] ??= new Intl.NumberFormat(
    `${language}-${language === 'en' ? 'GB' : 'ES'}`,
    {
      style: 'currency',
      currency: 'EUR',
    },
  )
  return eurFormatters[language].format(value)
}
