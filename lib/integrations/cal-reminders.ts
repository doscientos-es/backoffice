import { createHash } from 'node:crypto'

import type { createAdminClient } from '@/lib/supabase/admin'

import type { CalWebhookPayload } from './cal'

type AdminClient = ReturnType<typeof createAdminClient>

function reminderId(uid: string): string {
  const hex = createHash('sha256').update(`cal-booking:${uid}`).digest('hex').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`
}

export async function findCalBookingLead(db: AdminClient, payload: CalWebhookPayload) {
  const booking = payload.payload
  const uid =
    payload.triggerEvent === 'BOOKING_RESCHEDULED'
      ? booking.rescheduleUid || booking.rescheduledFromUid || booking.uid
      : booking.uid
  if (!uid) return null
  const { data, error } = await db
    .from('tasks')
    .select('lead_id')
    .eq('id', reminderId(uid))
    .maybeSingle()
  if (error) throw new Error('No se pudo localizar la reserva anterior.')
  return (data?.lead_id as string | null) ?? null
}

export async function syncCalBookingReminder(
  db: AdminClient,
  leadId: string,
  payload: CalWebhookPayload,
) {
  const { triggerEvent, payload: booking } = payload
  if (!['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED'].includes(triggerEvent))
    return
  if (!booking.uid || !Number.isFinite(Date.parse(booking.startTime))) {
    throw new Error('La reserva no tiene identificador o fecha válidos.')
  }

  const previousUid = booking.rescheduleUid || booking.rescheduledFromUid
  const cancel = async (uid: string) => {
    // A cancelled placeholder prevents a late BOOKING_CREATED retry from reopening it.
    const { error: insertError } = await db.from('tasks').upsert(
      {
        id: reminderId(uid),
        kind: 'reminder',
        action_type: 'meeting',
        title: booking.title || 'Reunión Cal.com',
        start_at: booking.startTime,
        lead_id: leadId,
        status: 'cancelled',
        priority: 'medium',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    )
    if (insertError) throw new Error('No se pudo registrar la cancelación de la reserva.')
    const { error } = await db
      .from('tasks')
      .update({ status: 'cancelled' })
      .eq('id', reminderId(uid))
      .in('status', ['todo', 'in_progress', 'in_review'])
      .is('completed_at', null)
      .is('deleted_at', null)
    if (error) throw new Error('No se pudo cancelar el aviso de la reserva.')
  }

  if (triggerEvent === 'BOOKING_CANCELLED') {
    await cancel(booking.uid)
    return
  }
  if (previousUid && previousUid !== booking.uid) await cancel(previousUid)

  const { data: lead, error: leadError } = await db
    .from('leads')
    .select('assigned_to')
    .eq('id', leadId)
    .is('deleted_at', null)
    .maybeSingle()
  if (leadError || !lead) throw new Error('No se pudo localizar el lead de la reserva.')
  const { error } = await db.from('tasks').upsert(
    {
      id: reminderId(booking.uid),
      kind: 'reminder',
      action_type: 'meeting',
      title: booking.title || 'Reunión Cal.com',
      start_at: booking.startTime,
      lead_id: leadId,
      assignee_id: lead.assigned_to ?? null,
      status: 'todo',
      priority: 'medium',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw new Error('No se pudo crear el aviso de la reserva.')
}
