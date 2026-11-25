import { describe, expect, it } from 'vitest'

import { boardColumnForLead } from '@/lib/leads/kanban-policy'
import type { LeadListItem } from '@/lib/leads/types'
import type { createAdminClient } from '@/lib/supabase/admin'

import type { CalWebhookPayload } from './cal'
import { findCalBookingLead, syncCalBookingReminder } from './cal-reminders'

function fakeDatabase() {
  const tasks = new Map<string, Record<string, unknown>>()
  let failWrites = false
  const db = {
    from(table: string) {
      let id = ''
      let patch: Record<string, unknown> | null = null
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === 'id') id = value
          return query
        },
        in: () => query,
        is: () => query,
        update: (value: Record<string, unknown>) => {
          patch = value
          return query
        },
        upsert: async (row: Record<string, unknown>) => {
          if (failWrites) return { error: { message: 'write failed' } }
          if (!tasks.has(row.id as string)) tasks.set(row.id as string, { ...row })
          return { error: null }
        },
        maybeSingle: async () => ({
          data: table === 'leads' ? { assigned_to: 'member-1' } : (tasks.get(id) ?? null),
          error: null,
        }),
        then: (resolve: (result: unknown) => void) => {
          const task = tasks.get(id)
          if (
            task &&
            patch &&
            ['todo', 'in_progress', 'in_review'].includes(task.status as string)
          ) {
            Object.assign(task, patch)
          }
          return Promise.resolve({ error: failWrites ? { message: 'write failed' } : null }).then(
            resolve,
          )
        },
      }
      return query
    },
  } as unknown as ReturnType<typeof createAdminClient>
  return {
    db,
    tasks,
    fail: () => {
      failWrites = true
    },
  }
}

function booking(event: string, uid: string, previousUid?: string): CalWebhookPayload {
  return {
    triggerEvent: event,
    createdAt: '2099-01-01T00:00:00Z',
    payload: {
      uid,
      rescheduleUid: previousUid,
      bookingId: 1,
      title: 'Reunión',
      startTime: uid === 'second' ? '2099-01-20T10:00:00Z' : '2099-01-10T10:00:00Z',
      endTime: '2099-01-20T11:00:00Z',
      attendees: [],
      organizer: { email: 'organizer@example.test', name: 'Organizer' },
    },
  }
}

describe('Cal.com booking reminders', () => {
  it('creates one reminder per booking and places active leads in the meeting column', async () => {
    const { db, tasks } = fakeDatabase()
    const event = booking('BOOKING_CREATED', 'first')
    await syncCalBookingReminder(db, 'lead-1', event)
    await syncCalBookingReminder(db, 'lead-1', event)
    expect(tasks.size).toBe(1)
    const reminder = [...tasks.values()][0]!
    expect(reminder).toMatchObject({
      lead_id: 'lead-1',
      action_type: 'meeting',
      assignee_id: 'member-1',
      status: 'todo',
    })
    const lead = {
      id: 'lead-1',
      status: 'contacted',
      scheduled_meeting_at: reminder.start_at,
    } as LeadListItem
    expect(boardColumnForLead(lead, new Date('2099-01-01'))).toBe('meeting')
    expect(boardColumnForLead({ ...lead, status: 'won' }, new Date('2099-01-01'))).toBe('won')
  })

  it('reschedules using the original lead and keeps cancellation safe against late retries', async () => {
    const { db, tasks } = fakeDatabase()
    const first = booking('BOOKING_CREATED', 'first')
    await syncCalBookingReminder(db, 'lead-1', first)
    const rescheduled = booking('BOOKING_RESCHEDULED', 'second', 'first')
    expect(await findCalBookingLead(db, rescheduled)).toBe('lead-1')
    await syncCalBookingReminder(db, 'lead-1', rescheduled)
    await syncCalBookingReminder(db, 'lead-1', first)
    expect([...tasks.values()].map((task) => task.status)).toEqual(['cancelled', 'todo'])
    await syncCalBookingReminder(db, 'lead-1', booking('BOOKING_CANCELLED', 'second'))
    await syncCalBookingReminder(db, 'lead-1', rescheduled)
    expect([...tasks.values()].map((task) => task.status)).toEqual(['cancelled', 'cancelled'])
  })

  it('does not create a reminder for other events and propagates write errors', async () => {
    const { db, tasks, fail } = fakeDatabase()
    await syncCalBookingReminder(db, 'lead-1', booking('OTHER', 'first'))
    expect(tasks.size).toBe(0)
    fail()
    await expect(
      syncCalBookingReminder(db, 'lead-1', booking('BOOKING_CREATED', 'first')),
    ).rejects.toThrow()
  })

  it('keeps a cancellation received before creation closed', async () => {
    const { db, tasks } = fakeDatabase()
    await syncCalBookingReminder(db, 'lead-1', booking('BOOKING_CANCELLED', 'first'))
    await syncCalBookingReminder(db, 'lead-1', booking('BOOKING_CREATED', 'first'))
    expect([...tasks.values()].map((task) => task.status)).toEqual(['cancelled'])
  })
})
