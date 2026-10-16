import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('./actions', () => ({ deleteLead: vi.fn(), updateLeadStatus: vi.fn() }))
vi.mock('./close-reason-dialog', () => ({ CloseReasonDialog: () => null }))
vi.mock('./reopen-confirm-dialog', () => ({ ReopenConfirmDialog: () => null }))
vi.mock('./quoted-suggestion-dialog', () => ({ QuotedSuggestionDialog: () => null }))
vi.mock('./lead-quick-view', () => ({ LeadQuickView: () => null }))
vi.mock('./[id]/phone-actions', () => ({ LeadCallLink: () => null }))
vi.mock('../reminders/schedule-reminder-dialog', () => ({ ScheduleReminderDialog: () => null }))

import { LeadsKanban } from './leads-kanban'

describe('lead kanban responsive columns', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  function renderBoard() {
    render(<LeadsKanban leads={[]} />)
    return screen.getByRole('region', {
      name: 'Etapas de leads. Desliza horizontalmente para ver las demás etapas.',
    })
  }

  it('fills the available mobile width without a fixed or viewport-based cap', () => {
    const board = renderBoard()
    const columns = within(board).getAllByRole('region')

    expect(columns.length).toBeGreaterThan(1)
    for (const column of columns) {
      expect(column.classList.contains('w-full')).toBe(true)
      expect(column.classList.contains('min-w-0')).toBe(true)
      expect(column.classList.contains('shrink-0')).toBe(true)
      expect(column.classList.contains('max-w-80')).toBe(false)
      expect(column.className).not.toContain('100vw')
    }
  })

  it('keeps horizontal swiping and alignment between stages', () => {
    const board = renderBoard()
    expect(board.classList.contains('overflow-x-auto')).toBe(true)
    expect(board.classList.contains('snap-x')).toBe(true)
    expect(board.classList.contains('snap-mandatory')).toBe(true)
    for (const column of within(board).getAllByRole('region')) {
      expect(column.classList.contains('snap-start')).toBe(true)
    }
  })

  it('preserves desktop column sizes and desktop-only collapsed stages', () => {
    const board = renderBoard()
    for (const column of within(board).getAllByRole('region')) {
      expect(column.classList.contains('sm:w-80')).toBe(true)
    }
    const archived = within(board).getByRole('region', { name: /Archivado.*0 leads/ })
    expect(archived.classList.contains('md:w-11')).toBe(true)
    expect(archived.classList.contains('w-full')).toBe(true)
  })
})

