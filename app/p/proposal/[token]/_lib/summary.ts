const DAY_MS = 86_400_000

/**
 * Whole days until the proposal stops being acceptable. The accept actions
 * reject proposals once `valid_until` is before today (UTC), so `0` means
 * "last day" and a negative number means it already expired.
 */
export function daysUntilExpiry(validUntil: string | null, now: Date = new Date()): number | null {
  if (!validUntil) return null
  const end = Date.parse(`${validUntil}T00:00:00Z`)
  if (Number.isNaN(end)) return null
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.round((end - today) / DAY_MS)
}
