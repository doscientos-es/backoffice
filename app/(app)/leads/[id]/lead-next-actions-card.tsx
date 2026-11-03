import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { NextAction } from '@/lib/leads/next-actions'
import type { listActiveMembers } from '@/lib/members/queries'
import { TASK_STATUS } from '@/lib/status'
import { relativeTime } from '@/lib/utils'

import { TaskCreateDialog } from '../../tasks/task-create-dialog'
import { LeadNextActionReminderItem } from './lead-next-action-reminder-item'
import { LeadNextActionTaskItem } from './lead-next-action-task-item'

export type { NextAction } from '@/lib/leads/next-actions'

type NextActionsCardProps = {
  canEdit: boolean
  leadId: string
  members: Awaited<ReturnType<typeof listActiveMembers>>
  currentUserId: string
  actions: NextAction[]
}

/** Open tasks and reminders of a lead, completable in place when the user can edit. */
export function NextActionsCard({
  canEdit,
  leadId,
  members,
  currentUserId,
  actions,
}: NextActionsCardProps) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">Siguiente paso</CardTitle>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            Próximos pasos para mantener el lead en movimiento.
          </p>
        </div>
        {canEdit ? (
          <TaskCreateDialog
            leadId={leadId}
            members={members}
            currentUserId={currentUserId}
            trigger={<Button size="sm">Nueva tarea</Button>}
          />
        ) : null}
      </CardHeader>
      <CardContent className="px-0 pt-0">
        {actions.length > 0 ? (
          <ul className="divide-y divide-border">
            {actions.map((action) => {
              const overdue = action.when ? new Date(action.when) < new Date() : false
              const whenLabel = action.when ? relativeTime(action.when) : null
              if (action.kind === 'task' && canEdit) {
                return (
                  <LeadNextActionTaskItem
                    key={`${action.kind}-${action.id}`}
                    task={{ ...action, overdue, whenLabel }}
                    leadId={leadId}
                    members={members}
                    currentUserId={currentUserId}
                  />
                )
              }
              if (action.kind === 'reminder' && canEdit) {
                return (
                  <LeadNextActionReminderItem
                    key={`${action.kind}-${action.id}`}
                    reminder={{ id: action.id, title: action.title, whenLabel, overdue }}
                  />
                )
              }
              return (
                <li
                  key={`${action.kind}-${action.id}`}
                  className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link
                    href={`/tasks/${action.id}`}
                    className="min-w-0 truncate font-medium hover:underline"
                  >
                    <span className="mr-2 text-xs text-muted-foreground">
                      {action.kind === 'reminder' ? 'Aviso' : 'Tarea'}
                    </span>
                    {action.title}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {action.kind === 'task' ? (
                      <StatusBadge meta={TASK_STATUS} value={action.status} />
                    ) : null}
                    {whenLabel ? (
                      <span
                        className={
                          overdue ? 'font-medium text-destructive' : 'text-muted-foreground'
                        }
                      >
                        {whenLabel}
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            Crea una tarea o un recordatorio para dejar claro qué toca hacer después.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
