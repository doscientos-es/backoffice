import type { parseScopeModules } from '@/lib/proposals/scope'

type ScopeModule = ReturnType<typeof parseScopeModules>[number]

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

/**
 * Sum of the module durations when every module has a weekly estimate.
 * Returns null when any module is missing one, so the page never invents a
 * deadline. Modules may overlap, so callers present it as an upper bound.
 */
export function estimatedTotalWeeks(modules: ScopeModule[]): number | null {
  if (modules.length === 0) return null
  let total = 0
  for (const module of modules) {
    if (module.duration_mode === 'custom' || !module.duration_weeks) return null
    total += module.duration_weeks
  }
  return total
}
