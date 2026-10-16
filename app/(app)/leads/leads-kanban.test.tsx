import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

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

  it('provides a shortcut to every stage with its lead count', () => {
    const board = renderBoard()
    const navigation = screen.getByRole('navigation', { name: 'Ir a una etapa de leads' })
    const shortcuts = within(navigation).getAllByRole('button')
    const columns = within(board).getAllByRole('region')
    expect(shortcuts).toHaveLength(columns.length)
    for (const [index, shortcut] of shortcuts.entries()) {
      expect(shortcut.getAttribute('aria-controls')).toBe(columns[index]?.id)
      expect(shortcut.getAttribute('aria-label')).toContain('0 leads')
    }
  })

  it.each([false, true])(
    'jumps horizontally without scrolling the page (reduced motion: %s)',
    (reducedMotion) => {
      const board = renderBoard()
      const target = within(board).getByRole('region', { name: /Reunión agendada.*0 leads/ })
      const scrollTo = vi.fn()
      Object.defineProperty(board, 'scrollTo', { value: scrollTo, configurable: true })
      board.scrollLeft = 40
      vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 20 } as DOMRect)
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ left: 500 } as DOMRect)
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: reducedMotion } as MediaQueryList)
      const focus = vi.spyOn(target, 'focus')

      fireEvent.click(screen.getByRole('button', { name: 'Ir a Reunión agendada: 0 leads' }))

      expect(scrollTo).toHaveBeenCalledWith({
        left: 520,
        behavior: reducedMotion ? 'instant' : 'smooth',
      })
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(document.activeElement).toBe(target)
    },
  )

  it('keeps refresh above the board with a touch-sized target', () => {
    renderBoard()
    const refresh = screen.getByRole('button', { name: /Actualizar leads/ })
    expect(refresh.classList.contains('size-11')).toBe(true)
  })
})
