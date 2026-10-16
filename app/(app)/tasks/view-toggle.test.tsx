import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ push: vi.fn(), params: new URLSearchParams() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.params,
}))

import { TasksViewToggle } from './view-toggle'

beforeEach(() => {
  navigation.push.mockReset()
  navigation.params = new URLSearchParams(
    'q=Test&project=project-1&priority=high&assignee=member-1&blocked=yes&status=todo&sort=title&dir=asc&page=3',
  )
})
afterEach(cleanup)

describe('task view navigation', () => {
  it.each(['board', 'list'] as const)('preserves filters and ordering when leaving %s', (view) => {
    navigation.params.set('view', view)
    const original = navigation.params.toString()
    render(<TasksViewToggle view={view} />)
    fireEvent.click(screen.getByRole('button', { name: view === 'list' ? 'Tablero' : 'Lista' }))

    const expected = new URLSearchParams(original)
    expected.delete('page')
    if (view === 'list') expected.delete('view')
    else expected.set('view', 'list')
    expect(navigation.push).toHaveBeenCalledWith(`/tasks?${expected.toString()}`)
    expect(navigation.params.toString()).toBe(original)
  })

  it('explicitly selects list view when no filters are active', () => {
    navigation.params = new URLSearchParams()
    render(<TasksViewToggle view="board" />)
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }))
    expect(navigation.push).toHaveBeenCalledWith('/tasks?view=list')
  })

  it('includes owner and blocked filters in the active count', () => {
    render(<TasksViewToggle view="board" />)
    expect(screen.getByTitle('6 filtros activos').textContent).toBe('6')
  })

  it('announces the selected view without navigating to it again', () => {
    render(<TasksViewToggle view="list" />)
    fireEvent.click(screen.getByRole('button', { name: 'Lista', pressed: true }))
    expect(navigation.push).not.toHaveBeenCalled()
  })
})
