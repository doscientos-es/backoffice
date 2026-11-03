import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CalendarView } from '@/lib/calendar/types'

import { CalendarHeader } from './calendar-header'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('layer=task&member=sample-member'),
}))

vi.mock('./calendar-grid', () => ({
  useCalendarCreate: () => vi.fn(),
}))

afterEach(cleanup)

function renderHeader(view: CalendarView) {
  return render(
    <CalendarHeader
      anchor="2026-09-03T12:00:00.000Z"
      view={view}
      teamMembers={[]}
      activeLayers={new Set()}
      onToggleLayer={vi.fn()}
      activeMembers={new Set()}
      onToggleMember={vi.fn()}
      calendarToken={null}
    />,
  )
}

describe('calendar header navigation links', () => {
  it('links to adjacent weeks and labels the visible week from Monday', () => {
    renderHeader('week')
    expect(screen.getByRole('heading', { name: 'Semana del 31 ago 2026' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Semana anterior' }).getAttribute('href')).toBe(
      '/calendar?layer=task&member=sample-member&date=2026-08-27',
    )
    expect(screen.getByRole('link', { name: 'Semana siguiente' }).getAttribute('href')).toBe(
      '/calendar?layer=task&member=sample-member&date=2026-09-10',
    )
  })

  it.each(['month', 'agenda'] as const)(
    'links to adjacent months in %s view and preserves filters',
    (view) => {
      renderHeader(view)
      expect(screen.getByRole('link', { name: 'Mes anterior' }).getAttribute('href')).toBe(
        '/calendar?layer=task&member=sample-member&date=2026-08-03',
      )
      expect(screen.getByRole('link', { name: 'Mes siguiente' }).getAttribute('href')).toBe(
        '/calendar?layer=task&member=sample-member&date=2026-10-03',
      )
    },
  )
})
