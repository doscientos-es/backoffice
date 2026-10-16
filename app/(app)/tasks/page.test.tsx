import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  listTasksBoard: vi.fn(),
  listTasksList: vi.fn(),
  role: 'admin',
}))
vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ id: 'member-1', role: mocks.role }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from: mocks.from }) }))
vi.mock('@/lib/tasks/queries', () => ({
  listTasksBoard: mocks.listTasksBoard,
  listTasksList: mocks.listTasksList,
}))
vi.mock('@/components/layout/list-controls', () => ({ ListControls: () => null }))
vi.mock('@/components/layout/page-header', () => ({ PageHeader: () => null }))
vi.mock('./task-create-dialog', () => ({ TaskCreateDialog: () => null }))
vi.mock('./task-row-actions', () => ({ TaskRowActions: () => null }))
vi.mock('./tasks-kanban', () => ({ TasksKanban: () => null }))
vi.mock('./tasks-list', () => ({ TasksList: () => null }))
vi.mock('./view-toggle', () => ({ TasksViewToggle: () => null }))

import TasksPage from './page'

type Member = { id: string; name: string }
const results = new Map<string, Promise<{ data: Member[] }>>()

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role = 'admin'
  results.clear()
  mocks.listTasksBoard.mockResolvedValue({ items: [], capped: false, error: null })
  mocks.listTasksList.mockResolvedValue({ data: [], count: 0, error: null })
  mocks.from.mockImplementation((table: string) => {
    const builder: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'is', 'order']) builder[method] = vi.fn(() => builder)
    // oxlint-disable-next-line unicorn/no-thenable -- Supabase queries are awaitable.
    builder.then = vi.fn((resolve, reject) =>
      (results.get(table) ?? Promise.resolve({ data: [] })).then(resolve, reject),
    )
    return builder
  })
})

describe('TasksPage loading', () => {
  it.each(['board', 'list'])('loads %s without waiting for filter options', async (view) => {
    let finish!: (result: { data: Member[] }) => void
    results.set(
      'team_members',
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const page = TasksPage({ searchParams: Promise.resolve({ view, q: 'Test', blocked: 'yes' }) })
    try {
      const query = view === 'board' ? mocks.listTasksBoard : mocks.listTasksList
      await vi.waitFor(() => expect(query).toHaveBeenCalledTimes(1))
      expect(query).toHaveBeenCalledWith(expect.objectContaining({ q: 'Test', blockedOnly: true }))
      expect(view === 'board' ? mocks.listTasksList : mocks.listTasksBoard).not.toHaveBeenCalled()
    } finally {
      finish({ data: [] })
    }
    await page
  })

  it.each([
    ['member-1', 'member-1'],
    ['unknown', ''],
  ])('validates selected owner %s before querying', async (assignee, expected) => {
    let finish!: (result: { data: Member[] }) => void
    results.set(
      'team_members',
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const page = TasksPage({ searchParams: Promise.resolve({ assignee }) })
    await vi.waitFor(() => expect(mocks.from).toHaveBeenCalledWith('team_members'))
    expect(mocks.listTasksBoard).not.toHaveBeenCalled()
    finish({ data: [{ id: 'member-1', name: 'Test member' }] })
    await page
    expect(mocks.listTasksBoard).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeId: expected }),
    )
  })

  it('keeps delivery owner restrictions and skips commercial options', async () => {
    mocks.role = 'delivery'
    results.set(
      'team_members',
      Promise.resolve({
        data: [
          { id: 'member-1', name: 'Self' },
          { id: 'member-2', name: 'Other' },
        ],
      }),
    )
    await TasksPage({ searchParams: Promise.resolve({ assignee: 'member-2', view: 'list' }) })
    expect(mocks.from).not.toHaveBeenCalledWith('leads')
    expect(mocks.from).not.toHaveBeenCalledWith('clients')
    expect(mocks.listTasksList).toHaveBeenCalledWith(expect.objectContaining({ assigneeId: '' }))
  })
})
