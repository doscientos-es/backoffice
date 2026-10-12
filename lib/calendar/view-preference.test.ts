import { describe, expect, it } from 'vitest'

import {
  CALENDAR_VIEW_COOKIE,
  parseCalendarView,
  serializeCalendarViewCookie,
} from '@/lib/calendar/view-preference'

describe('calendar view preference', () => {
  it('accepts each calendar view and defaults invalid values to month', () => {
    expect(parseCalendarView('month')).toBe('month')
    expect(parseCalendarView('week')).toBe('week')
    expect(parseCalendarView('agenda')).toBe('agenda')
    expect(parseCalendarView('invalid')).toBe('month')
    expect(parseCalendarView(undefined)).toBe('month')
  })

  it('creates a long-lived cookie and marks it secure on HTTPS', () => {
    expect(serializeCalendarViewCookie('week')).toBe(
      `${CALENDAR_VIEW_COOKIE}=week; Path=/; Max-Age=31536000; SameSite=Lax`,
    )
    expect(serializeCalendarViewCookie('agenda', true)).toContain('; Secure')
  })
})
