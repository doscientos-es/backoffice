import { escapeIlike } from '@/lib/utils/search-params'

/** Keep in sync with public.normalize_lead_search_text in the database. */
export function normalizeLeadSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function phoneDigits(value: string): string | null {
  if (!/^[+\d\s()./\-–—]+$/.test(value)) return null
  const digits = value.replace(/\D/g, '')
  if (!digits) return null

  // Only remove a Spanish country code from a complete number. A partial
  // search such as "34" must keep its meaning; other country codes stay intact.
  if (/^0034\d{9}$/.test(digits)) return digits.slice(4)
  if (/^34\d{9}$/.test(digits)) return digits.slice(2)
  return digits
}

function containsPattern(value: string): string {
  // ILIKE escaping and PostgREST quoting solve different problems: the latter
  // keeps commas, parentheses, quotes and backslashes inside a literal value.
  const pattern = `%${escapeIlike(value)}%`
  return `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Each OR group is ANDed with the others, before counting or paginating. */
export function buildLeadSearchFilters(input: string): string[] {
  const normalized = normalizeLeadSearchText(input).trim()
  if (!normalized) return []

  // A formatted phone is one contiguous search, not several unrelated chunks.
  const phone = phoneDigits(normalized)
  const terms = phone ? [normalized] : [...new Set(normalized.split(/\s+/))]

  return terms.map((term) => {
    const textFilter = `search_text.ilike.${containsPattern(term)}`
    const digits = phoneDigits(term)
    return digits ? `${textFilter},search_phone.ilike.${containsPattern(digits)}` : textFilter
  })
}
