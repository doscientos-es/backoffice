import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  eqCalls: [] as Array<[string, unknown]>,
  notCalls: [] as Array<[string, string, unknown]>,
}))

vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ error: vi.fn() }) }))
vi.mock('@/lib/supabase/filters', () => ({ notDeleted: <T>(query: T) => query }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => {
      const result = { data: [], error: null, count: 0 }
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          state.eqCalls.push([column, value])
          return builder
        },
        ilike: () => builder,
        not: (column: string, operator: string, value: unknown) => {
          state.notCalls.push([column, operator, value])
          return builder
        },
        is: () => builder,
        order: () => builder,
        range: async () => result,
        limit: async () => result,
      }
      return builder
    },
  }),
}))

import { listTasksBoard, listTasksList } from './queries'

describe('task assignee filter', () => {
  beforeEach(() => {
    state.eqCalls = []
    state.notCalls = []
  })

  it('applies the assignee to the list query', async () => {
    await listTasksList({ assigneeId: 'member-1' })

    expect(state.eqCalls).toContainEqual(['assignee_id', 'member-1'])
  })

  it('applies the assignee to the board query', async () => {
    await listTasksBoard({ assigneeId: 'member-1' })

    expect(state.eqCalls).toContainEqual(['assignee_id', 'member-1'])
  })

  it('filters blocked tasks in both views without inventing a new status', async () => {
    await listTasksList({ blockedOnly: true })
    await listTasksBoard({ blockedOnly: true })
    expect(state.notCalls).toEqual([
      ['blocked_reason', 'is', null],
      ['blocked_reason', 'is', null],
    ])
    expect(state.eqCalls).not.toContainEqual(['status', 'blocked'])
  })
})
