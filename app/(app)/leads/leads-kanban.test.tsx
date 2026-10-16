import { readFileSync } from 'node:fs'

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
vi.mock('./lazy-lead-quick-view', () => ({ LeadQuickView: () => null }))
vi.mock('./[id]/phone-actions', () => ({ LeadCallLink: () => null }))
vi.mock('../reminders/schedule-reminder-dialog', () => ({ ScheduleReminderDialog: () => null }))

import { LeadsKanban } from './leads-kanban'

type HappyDOMWindow = Window & {
  happyDOM: { setViewport: (viewport: { width: number; height: number }) => void }
}

describe('lead kanban responsive columns', () => {
  function setViewport(width: number) {
    const happyWindow = window as unknown as HappyDOMWindow
    happyWindow.happyDOM.setViewport({ width, height: 900 })
  }

  beforeEach(() => {
    window.localStorage.clear()
    setViewport(390)
    const style = document.createElement('style')
    style.dataset.leadsKanbanTestStyles = ''
    style.textContent = readFileSync('app/(app)/leads/leads-kanban.css', 'utf8')
    document.head.append(style)
  })
  afterEach(() => {
    cleanup()
    document.querySelector('[data-leads-kanban-test-styles]')?.remove()
    setViewport(390)
    vi.restoreAllMocks()
  })

  function renderBoard() {
    render(<LeadsKanban leads={[]} />)
    return screen.getByRole('region', {
      name: 'Etapas de leads. Desliza horizontalmente para ver las demás etapas.',
    })
  }

  function getNavigation() {
    const navigation = document.querySelector<HTMLElement>(
      'nav[aria-label="Ir a una etapa de leads"]',
    )
    if (!navigation) throw new Error('No se encontró la navegación del kanban de leads')
    return navigation
  }

  function getCompactToggle(column: HTMLElement, label: string) {
    const toggle = column.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
    if (!toggle) throw new Error(`No se encontró el control de columna «${label}»`)
    return toggle
  }

  it('fills the mobile viewport and displays the touch navigation', () => {
    const board = renderBoard()
    const columns = within(board).getAllByRole('region')
    const navigation = getNavigation()
    const toolbar = navigation.parentElement

    expect(columns.length).toBeGreaterThan(1)
    expect(toolbar && getComputedStyle(toolbar).display).toBe('flex')
    expect(getComputedStyle(board).scrollSnapType).toContain('mandatory')
    for (const column of columns) {
      expect(getComputedStyle(column).width).toBe('100%')
    }
  })

  it('keeps horizontal swiping and alignment between stages', () => {
    const board = renderBoard()
    expect(board.classList.contains('overflow-x-auto')).toBe(true)
    expect(getComputedStyle(board).scrollSnapType).toBe('x mandatory')
    for (const column of within(board).getAllByRole('region')) {
      expect(column.classList.contains('snap-start')).toBe(true)
    }
  })

  it('restores the parallel, compact desktop board and hides the mobile controls', () => {
    setViewport(1280)
    const board = renderBoard()
    const columns = within(board).getAllByRole('region')
    for (const column of columns.slice(0, 5)) {
      expect(getComputedStyle(column).width).toBe('320px')
    }
    expect(getComputedStyle(board).scrollSnapType).toBe('none')
    const toolbar = getNavigation().parentElement
    expect(toolbar && getComputedStyle(toolbar).display).toBe('none')
    for (const column of columns.slice(5)) {
      expect(getComputedStyle(column).width).toBe('44px')
      const details = column.querySelector('.leads-kanban-column-details')
      expect(details && getComputedStyle(details).display).toBe('none')
    }
  })

  it('provides a shortcut to every stage with its lead count', () => {
    const board = renderBoard()
    const navigation = getNavigation()
    const shortcuts = within(navigation).getAllByRole('button', { hidden: true })
    const columns = within(board).getAllByRole('region')
    expect(shortcuts).toHaveLength(columns.length)
    for (const [index, shortcut] of shortcuts.entries()) {
      expect(shortcut.getAttribute('aria-controls')).toBe(columns[index]?.id)
      expect(shortcut.getAttribute('aria-label')).toContain('0 leads')
    }
  })

  it('limits the stage shortcuts to mobile so desktop keeps its full board height', () => {
    const board = renderBoard()
    const navigation = getNavigation()

    expect(navigation.parentElement?.classList.contains('leads-kanban-mobile-toolbar')).toBe(true)
    expect(navigation.parentElement?.nextElementSibling).toBe(board)
  })

  it('expands compact desktop stages on hover and collapses them again on leave', () => {
    setViewport(1280)
    const board = renderBoard()

    for (const stage of ['Ganado', 'Perdido', 'No interesa', 'Archivado']) {
      const column = within(board).getByRole('region', { name: `${stage} · 0 leads` })
      const toggle = getCompactToggle(column, 'Mantener siempre visible')

      expect(column.dataset.collapsed).toBe('true')
      expect(getComputedStyle(toggle).display).toBe('none')

      fireEvent.pointerEnter(column)
      expect(column.dataset.collapsed).toBe('false')
      expect(column.dataset.hovered).toBe('true')

      fireEvent.pointerLeave(column)
      expect(column.dataset.collapsed).toBe('true')
      expect(column.dataset.hovered).toBe('false')
    }
  })

  it('keeps a stage expanded when pinned and saves the desktop preference', () => {
    setViewport(1280)
    const board = renderBoard()
    const column = within(board).getByRole('region', { name: 'Archivado · 0 leads' })

    fireEvent.pointerEnter(column)
    fireEvent.click(getCompactToggle(column, 'Mantener siempre visible'))
    fireEvent.pointerLeave(column)

    expect(column.dataset.collapsed).toBe('false')
    expect(window.localStorage.getItem('leads-kanban:compact-columns:v3')).toBe(
      JSON.stringify({ compact: [], expanded: ['archived'] }),
    )

    cleanup()
    const restoredBoard = renderBoard()
    const restoredColumn = within(restoredBoard).getByRole('region', {
      name: 'Archivado · 0 leads',
    })
    expect(restoredColumn.dataset.collapsed).toBe('false')

    fireEvent.pointerEnter(restoredColumn)
    fireEvent.click(getCompactToggle(restoredColumn, 'Colapsar cuando no esté en uso'))
    fireEvent.pointerLeave(restoredColumn)
    expect(restoredColumn.dataset.collapsed).toBe('true')
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

      fireEvent.click(
        within(getNavigation()).getByRole('button', {
          name: 'Ir a Reunión agendada: 0 leads',
          hidden: true,
        }),
      )

      expect(scrollTo).toHaveBeenCalledWith({
        left: 520,
        behavior: reducedMotion ? 'instant' : 'smooth',
      })
      expect(focus).toHaveBeenCalledWith({ preventScroll: true })
      expect(document.activeElement).toBe(target)
    },
  )

  it('keeps touch refresh above the mobile board and desktop refresh in the footer', () => {
    const board = renderBoard()
    const [mobileRefresh, desktopRefresh] = document.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Actualizar leads"]',
    )

    expect(mobileRefresh?.classList.contains('size-11')).toBe(true)
    expect(mobileRefresh?.parentElement?.classList.contains('leads-kanban-mobile-toolbar')).toBe(
      true,
    )
    expect(desktopRefresh?.classList.contains('leads-kanban-desktop-refresh')).toBe(true)
    expect(desktopRefresh?.parentElement).toBe(board.nextElementSibling)
    setViewport(1280)
    const mobileToolbar = mobileRefresh?.parentElement
    expect(mobileToolbar && getComputedStyle(mobileToolbar).display).toBe('none')
    expect(desktopRefresh && getComputedStyle(desktopRefresh).display).toBe('flex')
  })
})
