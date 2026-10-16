import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.params,
}))

import { LeadsViewToggle } from './view-toggle'

describe('lead view navigation', () => {
  beforeEach(() => {
    navigation.push.mockReset()
    navigation.params = new URLSearchParams(
      'q=600+000+000&status=new&source=Landing&solution=Software&assignee=member-1&attention=urgent&ids=lead-1,lead-2&sort=name&dir=asc&page=4',
    )
  })
  afterEach(cleanup)

  it.each(['board', 'list'] as const)('keeps every filter when leaving %s', (view) => {
    navigation.params.set('view', view)
    const original = navigation.params.toString()
    render(<LeadsViewToggle view={view} />)
    fireEvent.click(screen.getByRole('button', { name: view === 'list' ? 'Tablero' : 'Lista' }))

    expect(navigation.push).toHaveBeenCalledTimes(1)
    const destination = new URL(navigation.push.mock.calls[0]![0], 'https://example.test')
    const expected = new URLSearchParams(original)
    expected.delete('page')
    if (view === 'list') expected.delete('view')
    else expected.set('view', 'list')
    expect(destination.pathname).toBe('/leads')
    expect(destination.searchParams.toString()).toBe(expected.toString())
    expect(navigation.params.toString()).toBe(original)
  })

  it('counts solution and status filters even on the board', () => {
    render(<LeadsViewToggle view="board" />)
    expect(screen.getByTitle('7 filtros activos').textContent).toBe('7')
  })

  it('announces the selected view and does not navigate to it again', () => {
    render(<LeadsViewToggle view="list" />)
    const list = screen.getByRole('button', { name: 'Lista', pressed: true })
    fireEvent.click(list)
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('keeps analytics accessible when the text is hidden on mobile', () => {
    render(<LeadsViewToggle view="board" />)
    fireEvent.click(screen.getByRole('button', { name: 'Análisis' }))
    expect(navigation.push).toHaveBeenCalledWith('/leads/analytics')
  })
})
