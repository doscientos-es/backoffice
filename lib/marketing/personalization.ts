export type MarketingPersonalization = {
  name: string | null
  company: string | null
  email: string
}

export const MARKETING_VARIABLES = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'email', label: 'Email' },
] as const

/** Substitute only supported variables, in one pass, leaving unknown ones visible. */
export function personalizeMarketingText(
  text: string,
  contact: MarketingPersonalization,
  escapeValue: (value: string) => string = (value) => value,
): string {
  const values = {
    nombre: contact.name ?? '',
    empresa: contact.company ?? '',
    email: contact.email,
  }
  return text.replace(/\{\{\s*(nombre|empresa|email)\s*\}\}/g, (_, key: keyof typeof values) =>
    escapeValue(values[key]),
  )
}
