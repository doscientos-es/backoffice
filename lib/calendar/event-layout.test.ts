import { describe, expect, it } from 'vitest'

import { layoutOverlappingEvents } from '@/lib/calendar/event-layout'

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe('layoutOverlappingEvents', () => {
  it('places simultaneous events side by side and reuses a freed column', () => {
    const positions = layoutOverlappingEvents([
      { id: 'long', start: 9 * HOUR, end: 12 * HOUR },
      { id: 'first-short', start: 10 * HOUR, end: 11 * HOUR },
      { id: 'second-short', start: 11 * HOUR, end: 12 * HOUR },
    ])

    expect(positions.get('long')).toEqual({ column: 0, columnCount: 2 })
    expect(positions.get('first-short')).toEqual({ column: 1, columnCount: 2 })
    expect(positions.get('second-short')).toEqual({ column: 1, columnCount: 2 })
  })

  it('starts a fresh full-width layout for events that do not overlap', () => {
    const positions = layoutOverlappingEvents([
      { id: 'morning', start: 9 * HOUR, end: 10 * HOUR },
      { id: 'afternoon', start: 11 * HOUR, end: 12 * HOUR },
    ])

    expect(positions.get('morning')).toEqual({ column: 0, columnCount: 1 })
    expect(positions.get('afternoon')).toEqual({ column: 0, columnCount: 1 })
  })

  it('accounts for the minimum height used to draw short events', () => {
    const positions = layoutOverlappingEvents([
      { id: 'short', start: 9 * HOUR, end: 9 * HOUR + 5 * MINUTE },
      { id: 'next', start: 9 * HOUR + 10 * MINUTE, end: 10 * HOUR },
    ])

    expect(positions.get('short')).toEqual({ column: 0, columnCount: 2 })
    expect(positions.get('next')).toEqual({ column: 1, columnCount: 2 })
  })
})
