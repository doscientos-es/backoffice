import type { createServerClient } from '@/lib/supabase/server'

import {
  CALL_AUTO_FOLLOW_UP,
  CALL_REMINDER_DESCRIPTION,
  CALL_REMINDER_NOTIFIED_DESCRIPTION,
} from './call-workflow'

const AUTOMATIC_CALL_MARKERS = [
  CALL_REMINDER_DESCRIPTION,
  CALL_REMINDER_NOTIFIED_DESCRIPTION,
  CALL_AUTO_FOLLOW_UP,
]

/** One current next step per lead/rep, protected against concurrent inserts by the DB index. */
export async function ensureCallReminder(
  db: Awaited<ReturnType<typeof createServerClient>>,
  input: {
    leadId: string
    memberId: string
    title: string
    description: typeof CALL_REMINDER_DESCRIPTION | typeof CALL_AUTO_FOLLOW_UP
    startAt: string
  },
): Promise<void> {
  const patch = { title: input.title, description: input.description, start_at: input.startAt }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: existing, error: updateError } = await db
      .from('tasks')
      .update(patch)
      .eq('lead_id', input.leadId)
      .eq('assignee_id', input.memberId)
      .eq('kind', 'reminder')
      .in('description', AUTOMATIC_CALL_MARKERS)
      .eq('status', 'todo')
      .is('completed_at', null)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()
    if (updateError) throw new Error('No se pudo actualizar el aviso de llamada.')
    if (existing) return

    const { error: insertError } = await db.from('tasks').insert({
      ...patch,
      kind: 'reminder',
      lead_id: input.leadId,
      assignee_id: input.memberId,
      created_by: input.memberId,
      status: 'todo',
      priority: 'medium',
    })
    if (!insertError) return
    // Another request may have inserted the same next step since our update.
    if (insertError.code !== '23505') throw new Error('No se pudo programar el aviso de llamada.')
  }
  throw new Error('No se pudo actualizar el aviso. Vuelve a intentarlo.')
}
