import type { CalendarView } from '@/lib/calendar/types'

export const CALENDAR_VIEW_COOKIE = 'backoffice-calendar-view'

export function parseCalendarView(value: unknown): CalendarView {
  if (value === 'week' || value === 'agenda') return value
  return 'month'
}

export function serializeCalendarViewCookie(view: CalendarView, secure = false): string {
  const secureAttribute = secure ? '; Secure' : ''
  return `${CALENDAR_VIEW_COOKIE}=${view}; Path=/; Max-Age=31536000; SameSite=Lax${secureAttribute}`
}
