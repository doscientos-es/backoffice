import type { PortalLanguage } from './i18n'

export function presentationUrl(token: string, language: PortalLanguage): string {
  return `/deck/${encodeURIComponent(token)}?lang=${language}`
}
