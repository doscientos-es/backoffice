import type { LeadDiscoveryQuestion } from './types'

/** Normalizes question text for conservative duplicate detection. */
export function normalizeDiscoveryQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function removeDuplicateDiscoverySuggestions<T extends { question: string }>(
  suggestions: T[],
  existing: LeadDiscoveryQuestion[],
): T[] {
  const seen = new Set(existing.map((item) => normalizeDiscoveryQuestion(item.question)))
  return suggestions.filter((suggestion) => {
    const normalized = normalizeDiscoveryQuestion(suggestion.question)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}