import { createServerClient } from '@/lib/supabase/server'

import type { EmailMarketingSequence, EmailMarketingStep } from './email-marketing'

export type CalendarEmail = {
  step: Pick<EmailMarketingStep, 'id' | 'title' | 'scheduled_at' | 'status'>
  sequence: Pick<EmailMarketingSequence, 'id' | 'list_id' | 'name' | 'status' | 'list_name'>
}

/** A narrow, RLS-protected query; Madrid month boundaries are filtered by the caller. */
export async function getEmailMarketingCalendar(
  year: number,
  month: number,
): Promise<CalendarEmail[]> {
  const supabase = await createServerClient()
  // Include the previous UTC day for Madrid's positive offset, including DST.
  const start = new Date(Date.UTC(year, month - 1, 0)).toISOString()
  const end = new Date(Date.UTC(year, month, 1)).toISOString()
  const entries: CalendarEmail[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from('email_marketing_sequence_steps')
      .select(
        'id, title, scheduled_at, status, sequence:email_marketing_sequences!inner(id, list_id, name, status, list:email_marketing_lists(name))',
      )
      .is('sequence.deleted_at', null)
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at')
      .order('id')
      .range(offset, offset + 999)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as (CalendarEmail['step'] & {
      sequence: Omit<CalendarEmail['sequence'], 'list_name'> & { list: { name: string } | null }
    })[]
    entries.push(
      ...rows.map(({ sequence, ...step }) => ({
        step,
        sequence: {
          id: sequence.id,
          list_id: sequence.list_id,
          name: sequence.name,
          status: sequence.status,
          list_name: sequence.list?.name ?? 'Lista archivada',
        },
      })),
    )
    if (rows.length < 1000) break
  }
  return entries
}
