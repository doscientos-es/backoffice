import { describe, expect, it } from 'vitest'

import { buildLeadNextActions } from './next-actions'
import type { LeadRelatedTask } from './types'

function task(id: string, overrides: Partial<LeadRelatedTask> = {}): LeadRelatedTask {
  return {
    id,
    title: id,
    kind: 'task',
    status: 'todo',
    due_date: null,
    description: null,
    priority: 'medium',
    completed_at: null,
    ...overrides,
  }
}

describe('lead next steps', () => {
  it('shows a reminder exactly once, never again as a task', () => {
    const actions = buildLeadNextActions({
      tasks: [task('call', { kind: 'reminder' }), task('manual')],
      reminders: [{ id: 'call', title: 'Registrar llamada', remind_at: '2026-11-04T10:00:00Z' }],
    })
    expect(actions.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: 'call', kind: 'reminder' },
      { id: 'manual', kind: 'task' },
    ])
  })

  it('keeps completed, cancelled and event rows out of pending next steps', () => {
    const actions = buildLeadNextActions({
      tasks: [
        task('done', { status: 'done' }),
        task('cancelled', { status: 'cancelled' }),
        task('completed', { completed_at: '2026-11-03T10:00:00Z' }),
        task('event', { kind: 'event' }),
        task('working', { status: 'in_progress' }),
        task('review', { status: 'in_review' }),
        task('legacy', { kind: null }),
      ],
      reminders: [],
    })
    expect(actions.map(({ id }) => id)).toEqual(['working', 'review', 'legacy'])
  })

  it('sorts dated actions first and preserves undated task ordering', () => {
    const actions = buildLeadNextActions({
      tasks: [task('undated'), task('later', { due_date: '2026-11-06' }), task('undated-2')],
      reminders: [{ id: 'earlier', title: 'Reintentar', remind_at: '2026-11-04T10:00:00Z' }],
    })
    expect(actions.map(({ id }) => id)).toEqual(['earlier', 'later', 'undated', 'undated-2'])
  })
})
