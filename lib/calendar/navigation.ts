import { addMonths, addWeeks, format } from 'date-fns'

import type { CalendarView } from './types'

/** Agenda is month-anchored; the weekly view moves exactly one calendar week. */
export function calendarNavigation(anchor: Date, view: CalendarView) {
  const shift = view === 'week' ? addWeeks : addMonths
  return {
    previous: format(shift(anchor, -1), 'yyyy-MM-dd'),
    next: format(shift(anchor, 1), 'yyyy-MM-dd'),
  }
}
