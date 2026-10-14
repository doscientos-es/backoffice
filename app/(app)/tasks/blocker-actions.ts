'use server'

import { defineAction } from '@/lib/actions/define-action'
import { VersionConflictError } from '@/lib/concurrency/version-conflict'
import { SetTaskBlockerInput } from '@/lib/schemas/developer-workflow'
import { createServerClient } from '@/lib/supabase/server'

export const setTaskBlocker = defineAction<
  typeof SetTaskBlockerInput,
  { version: number; projectId: string | null }
>({
  name: 'tasks.setBlocker',
  schema: SetTaskBlockerInput,
  roles: ['owner', 'admin', 'member', 'sales', 'delivery'],
  revalidate: (payload, input) => [
    '/tasks',
    '/inicio',
    `/tasks/${input.taskId}`,
    ...(payload.projectId ? [`/projects/${payload.projectId}`] : []),
  ],
  handler: async (input) => {
    const supabase = await createServerClient()
    const { data, error } = await supabase.rpc('set_task_blocker', {
      p_task_id: input.taskId,
      p_expected_version: input.expectedVersion,
      p_reason: input.reason,
      p_owner_id: input.ownerId,
      p_review_on: input.reviewOn,
    })
    if (error?.code === '40001') throw new VersionConflictError()
    if (error) throw error
    return data as { version: number; projectId: string | null }
  },
})
