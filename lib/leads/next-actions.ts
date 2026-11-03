import type { TaskStatus } from '@/lib/status'

import type { LeadDetailResult } from './types'

export type NextAction = {
  id: string
  title: string
  kind: 'task' | 'reminder'
  when: string | null
  status: TaskStatus
}

/** Reminders already have their own list; completed work belongs in history. */
export function buildLeadNextActions({
  tasks,
  reminders,
}: Pick<LeadDetailResult, 'tasks' | 'reminders'>): NextAction[] {
  return [
    ...tasks
      .filter(
        (task) =>
          (task.kind == null || task.kind === 'task') &&
          task.completed_at == null &&
          ['todo', 'in_progress', 'in_review'].includes(task.status),
      )
      .map((task) => ({
        id: task.id,
        title: task.title,
        kind: 'task' as const,
        when: task.due_date,
        status: task.status as TaskStatus,
      })),
    ...reminders.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      kind: 'reminder' as const,
      when: reminder.remind_at,
      status: 'todo' as const,
    })),
  ].sort((a, b) => {
    if (!a.when && !b.when) return 0
    if (!a.when) return 1
    if (!b.when) return -1
    return new Date(a.when).getTime() - new Date(b.when).getTime()
  })
}
