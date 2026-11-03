import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { createServerClient } from '@/lib/supabase/server'

import { ensureCallReminder } from './call-reminders'

const maybeSingle = vi.fn()
const insert = vi.fn()
const update = vi.fn()
const eq = vi.fn()
const is = vi.fn()
const inFilter = vi.fn()
const builder = { update, eq, is, in: inFilter, select: () => builder, maybeSingle, insert }
const from = vi.fn(() => builder)
const db = { from } as unknown as Awaited<ReturnType<typeof createServerClient>>
const input = {
  leadId: 'synthetic-lead',
  memberId: 'synthetic-member',
  title: 'Registrar llamada',
  description: 'CALL_PENDING' as const,
  startAt: '2026-11-03T10:03:00Z',
}

beforeEach(() => {
  vi.resetAllMocks()
  from.mockReturnValue(builder)
  for (const method of [update, eq, is, inFilter]) method.mockReturnValue(builder)
  maybeSingle.mockResolvedValue({ data: null, error: null })
  insert.mockResolvedValue({ error: null })
})

describe('automatic call reminder slot', () => {
  it('refreshes the same reminder for repeated starts and subsequent retry scheduling', async () => {
    await ensureCallReminder(db, input)
    maybeSingle.mockResolvedValue({ data: { id: 'existing' }, error: null })
    await ensureCallReminder(db, input)
    await ensureCallReminder(db, {
      ...input,
      title: 'Reintentar llamada',
      description: 'CALL_AUTO_FOLLOW_UP',
      startAt: '2026-11-04T10:00:00Z',
    })
    expect(insert).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenLastCalledWith({
      title: 'Reintentar llamada',
      description: 'CALL_AUTO_FOLLOW_UP',
      start_at: '2026-11-04T10:00:00Z',
    })
  })

  it('only changes open automatic reminders for this lead and rep', async () => {
    await ensureCallReminder(db, input)
    expect(eq).toHaveBeenCalledWith('lead_id', input.leadId)
    expect(eq).toHaveBeenCalledWith('assignee_id', input.memberId)
    expect(eq).toHaveBeenCalledWith('kind', 'reminder')
    expect(eq).toHaveBeenCalledWith('status', 'todo')
    expect(is).toHaveBeenCalledWith('completed_at', null)
    expect(is).toHaveBeenCalledWith('deleted_at', null)
    expect(inFilter).toHaveBeenCalledWith('description', [
      'CALL_PENDING',
      'CALL_PENDING_NOTIFIED',
      'CALL_AUTO_FOLLOW_UP',
    ])
  })

  it('handles a concurrent insertion by refreshing the winning reminder', async () => {
    insert.mockResolvedValueOnce({ error: { code: '23505' } })
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'concurrent' }, error: null })
    await ensureCallReminder(db, input)
    expect(insert).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('does not insert after an update failure or retry unrelated insert errors', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    await expect(ensureCallReminder(db, input)).rejects.toThrow('actualizar')
    expect(insert).not.toHaveBeenCalled()
    insert.mockResolvedValueOnce({ error: { code: '42501' } })
    await expect(ensureCallReminder(db, input)).rejects.toThrow('programar')
    expect(insert).toHaveBeenCalledTimes(1)
  })
})
