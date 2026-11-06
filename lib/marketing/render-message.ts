import { markdownToHtml } from '@/lib/email/templates'

import { type MarketingPersonalization, personalizeMarketingText } from './personalization'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]!
  })
}

export function renderMarketingMessage(
  message: { subject: string; previewText?: string | null; bodyMarkdown: string },
  contact: MarketingPersonalization,
): { subject: string; html: string } {
  let html = personalizeMarketingText(markdownToHtml(message.bodyMarkdown), contact, escapeHtml)
  if (message.previewText) {
    html = `<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent">${personalizeMarketingText(message.previewText, contact, escapeHtml)}</div>${html}`
  }
  return { subject: personalizeMarketingText(message.subject, contact), html }
}
