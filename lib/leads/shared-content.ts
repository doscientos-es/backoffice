export type LeadSharedIdentity = {
  name: string
  alias?: string | null
  company?: string | null
}

/** Prefer the company for content shared with a lead; otherwise use their name. */
export function publicLeadName(lead: LeadSharedIdentity): string {
  return lead.company?.trim() || lead.name.trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Replace internal aliases and the contact name in content sent to the lead. */
export function sanitizeLeadSharedText(text: string, lead: LeadSharedIdentity): string {
  const publicName = publicLeadName(lead)
  const replacements = [
    ...new Set(
      [lead.alias?.trim(), lead.name.trim()].filter((value): value is string => Boolean(value)),
    ),
  ]
    .filter((value) => value.toLowerCase() !== publicName.toLowerCase())
    .sort((left, right) => right.length - left.length)

  if (!publicName || replacements.length === 0) return text

  const alternatives = replacements.map(escapeRegExp).join('|')
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])([.!?]?)`,
    'giu',
  )

  return text.replace(pattern, (_match, punctuation: string) => {
    const separator = punctuation && !publicName.endsWith(punctuation) ? punctuation : ''
    return `${publicName}${separator}`
  })
}
