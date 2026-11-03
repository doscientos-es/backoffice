import { afterEach, describe, expect, it, vi } from 'vitest'

import { calendarNavigation } from '@/lib/calendar/navigation'

afterEach(() => vi.unstubAllEnvs())

describe('calendar period navigation', () => {
  it('moves by one week instead of one month in weekly view', () => {
    expect(calendarNavigation(new Date(2026, 8, 3), 'week')).toEqual({
      previous: '2026-08-27',
      next: '2026-09-10',
    })
  })

  it('keeps consecutive weekly steps reversible across year boundaries', () => {
    const anchor = new Date(2026, 11, 31)
    const next = calendarNavigation(anchor, 'week').next
    const [year, month, day] = next.split('-').map(Number)
    expect(next).toBe('2027-01-07')
    expect(calendarNavigation(new Date(year, month - 1, day), 'week').previous).toBe('2026-12-31')
    expect(anchor.getDate()).toBe(31)
  })

  it.each(['month', 'agenda'] as const)('keeps %s navigation monthly', (view) => {
    expect(calendarNavigation(new Date(2026, 8, 3), view)).toEqual({
      previous: '2026-08-03',
      next: '2026-10-03',
    })
  })

  it.each([
    [2026, '2026-02-28'],
    [2028, '2028-02-29'],
  ] as const)('clamps month-end navigation to the last day of February in %s', (year, next) => {
    expect(calendarNavigation(new Date(year, 0, 31), 'month').next).toBe(next)
  })

  it.each(['UTC', 'Europe/Madrid', 'America/Los_Angeles'])(
    'preserves local calendar dates across daylight-saving changes in %s',
    (timezone) => {
      vi.stubEnv('TZ', timezone)
      expect(calendarNavigation(new Date(2026, 2, 26), 'week')).toEqual({
        previous: '2026-03-19',
        next: '2026-04-02',
      })
      expect(calendarNavigation(new Date(2026, 9, 29), 'week')).toEqual({
        previous: '2026-10-22',
        next: '2026-11-05',
      })
    },
  )
})
