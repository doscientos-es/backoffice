import { readFileSync } from 'node:fs'

import type * as DndKitCore from '@dnd-kit/core'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/leads',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof DndKitCore>()
  return { ...actual, DragOverlay: () => null }
})
vi.mock('./actions', () => ({ deleteLead: vi.fn(), updateLeadStatus: vi.fn() }))
vi.mock('./close-reason-dialog', () => ({ CloseReasonDialog: () => null }))
vi.mock('./reopen-confirm-dialog', () => ({ ReopenConfirmDialog: () => null }))
vi.mock('./quoted-suggestion-dialog', () => ({ QuotedSuggestionDialog: () => null }))
vi.mock('./lazy-lead-quick-view', () => ({ LeadQuickView: () => null }))
vi.mock('./[id]/phone-actions', () => ({ LeadCallLink: () => null }))
vi.mock('../reminders/schedule-reminder-dialog', () => ({ ScheduleReminderDialog: () => null }))

import { LeadsKanban, type KanbanLead } from './leads-kanban'

const DRAGGABLE_LEAD: KanbanLead = {
  id: 'lead-drag-test',
  version: 1,
  name: 'Lead de prueba',
  alias: null,
  company: null,
  email: null,
  phone: null,
  source: null,
  notes: null,
  status: 'new',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  estimated_value: null,
  score: null,
  company_size: null,
  solution_type: null,
  urgency: null,
  first_contacted_at: null,
  landing_path: null,
  landing_ref: null,
  landing_subject: null,
  conversion_step: null,
  first_landing_path: null,
  utm_campaign: null,
  marketing_campaign_name: null,
  last_utm_source: null,
  last_utm_campaign: null,
  ai_summary: null,
  ai_updated_at: null,
  lost_reason: null,
  lost_at: null,
  client: null,
  assignee: null,
  recent_interactions: [],
  next_action: null,
  scheduled_meeting_at: null,
  scheduled_meeting_duration_minutes: null,
}

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

  function renderBoard(leads: KanbanLead[] = []) {
    render(<LeadsKanban leads={leads} canEdit={leads.length > 0} />)
    return screen.getByRole('region', {
      name: 'Etapas de leads. Desliza horizontalmente para ver las demás etapas.',
    })
  }

  function getCompactToggle(column: HTMLElement, label: string) {
    const toggle = column.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
    if (!toggle) throw new Error(`No se encontró el control de columna «${label}»`)
    return toggle
  }

  it('fills the mobile viewport without a category dock and keeps the board swipeable', () => {
    const board = renderBoard()
    const columns = within(board).getAllByRole('region')

    expect(columns.length).toBeGreaterThan(1)
    expect(document.querySelector('nav[aria-label="Ir a una etapa de leads"]')).toBeNull()
    expect(getComputedStyle(board).flexGrow).toBe('1')
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
    const mobileRefresh = document.querySelector<HTMLButtonElement>(
      'button.leads-kanban-mobile-refresh',
    )
    const desktopRefresh = document.querySelector<HTMLButtonElement>(
      'button.leads-kanban-desktop-refresh',
    )
    expect(mobileRefresh && getComputedStyle(mobileRefresh).display).toBe('none')
    expect(desktopRefresh && getComputedStyle(desktopRefresh).display).toBe('flex')
    for (const column of columns.slice(5)) {
      expect(getComputedStyle(column).width).toBe('44px')
      const details = column.querySelector('.leads-kanban-column-details')
      expect(details && getComputedStyle(details).display).toBe('none')
    }
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

  it('reserves the pin control space so it does not shift the header on hover', () => {
    setViewport(1280)
    const board = renderBoard()
    const [column] = within(board).getAllByRole('region')
    if (!column) throw new Error('No se encontró una etapa del kanban')
    const toggle = getCompactToggle(column, 'Colapsar cuando no esté en uso')

    expect(getComputedStyle(toggle).display).toBe('inline-flex')
    expect(getComputedStyle(toggle).visibility).toBe('hidden')
    expect(toggle.classList.contains('p-0')).toBe(true)

    fireEvent.pointerEnter(column)
    expect(column.dataset.hovered).toBe('true')
    expect(getComputedStyle(toggle).display).toBe('inline-flex')

    fireEvent.pointerLeave(column)
    expect(column.dataset.hovered).toBe('false')
    expect(getComputedStyle(toggle).display).toBe('inline-flex')
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

  it('keeps touch and desktop refresh in the compact footer', () => {
    const board = renderBoard()
    const mobileRefresh = document.querySelector<HTMLButtonElement>(
      'button.leads-kanban-mobile-refresh',
    )
    const desktopRefresh = document.querySelector<HTMLButtonElement>(
      'button.leads-kanban-desktop-refresh',
    )

    expect(mobileRefresh && getComputedStyle(mobileRefresh).width).toBe('40px')
    expect(mobileRefresh && getComputedStyle(mobileRefresh).display).toBe('inline-flex')
    expect(mobileRefresh?.parentElement?.classList.contains('leads-kanban-footer')).toBe(true)
    expect(desktopRefresh?.classList.contains('leads-kanban-desktop-refresh')).toBe(true)
    expect(desktopRefresh?.parentElement).toBe(board.nextElementSibling)
    expect(mobileRefresh?.parentElement).toBe(desktopRefresh?.parentElement)
    expect(document.querySelector('.leads-kanban-mobile-toolbar')).toBeNull()
  })

  it('keeps every desktop stage expanded while dragging a card', () => {
    setViewport(1280)
    const board = renderBoard([DRAGGABLE_LEAD])
    const columns = within(board).getAllByRole('region')
    const compactColumns = columns.filter((column) => column.dataset.collapsed === 'true')
    const dragHandle = within(board).getByRole('button', { name: 'Arrastrar Lead de prueba' })

    expect(compactColumns.length).toBeGreaterThan(0)
    act(() => {
      fireEvent.pointerDown(dragHandle, {
        button: 0,
        pointerId: 1,
        isPrimary: true,
        pointerType: 'mouse',
        clientX: 0,
        clientY: 0,
      })
      fireEvent.pointerMove(document, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 0,
      })
    })

    for (const column of columns) {
      expect(column.dataset.collapsed).toBe('false')
    }

    act(() => {
      fireEvent.pointerCancel(document, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 10,
        clientY: 0,
      })
    })
    for (const column of compactColumns) {
      expect(column.dataset.collapsed).toBe('true')
    }
  })
})
