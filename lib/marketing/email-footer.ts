export const MARKETING_FOOTER_MESSAGE =
  'Si prefieres que no volvamos a contactarte, puedes solicitar tu baja aquí:'
export const MARKETING_UNSUBSCRIBE_LABEL = 'Dejar de recibir correos'
export const MARKETING_PRIVACY_LABEL = 'Política de privacidad'

function escapeAttribute(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  )
}

export function renderMarketingFooter(unsubscribeUrl: string, privacyUrl: string): string {
  return `<hr style="border:0;border-top:1px solid #e5e7eb;margin:28px 0 16px"/><div style="font-size:12px;line-height:20px;color:#6b7280"><p style="margin:0 0 8px">${MARKETING_FOOTER_MESSAGE}</p><p style="margin:0 0 8px"><a href="${escapeAttribute(unsubscribeUrl)}" style="color:#4b5563">${MARKETING_UNSUBSCRIBE_LABEL}</a></p><p style="margin:0"><a href="${escapeAttribute(privacyUrl)}" style="color:#4b5563">${MARKETING_PRIVACY_LABEL}</a></p></div>`
}
