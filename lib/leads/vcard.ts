export function normalizeLeadPhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  const plusIndex = cleaned.indexOf('+')
  return plusIndex > 0 ? cleaned.slice(plusIndex) : cleaned
}

function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

export function buildLeadVCard({
  leadId,
  name,
  phone,
  email,
  company,
}: {
  leadId: string
  name: string
  phone: string
  email?: string | null
  company?: string | null
}): string {
  const fullName = name.trim() || phone.trim() || 'Contacto'
  const nameParts = fullName.split(/\s+/)
  const givenName = nameParts[0] ?? fullName
  const familyName = nameParts.slice(1).join(' ')
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `UID:urn:doscientos:lead:${leadId}`,
    'CATEGORIES:Lead',
    `N:${escapeVCardValue(familyName)};${escapeVCardValue(givenName)};;;`,
    `FN:${escapeVCardValue(fullName)}`,
    `TEL;TYPE=CELL:${escapeVCardValue(normalizeLeadPhone(phone))}`,
    ...(email?.trim() ? [`EMAIL;TYPE=INTERNET:${escapeVCardValue(email.trim())}`] : []),
    ...(company?.trim() ? [`ORG:${escapeVCardValue(company.trim())}`] : []),
    'END:VCARD',
    '',
  ].join('\r\n')
}
