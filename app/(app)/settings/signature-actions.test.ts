import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state, upsert, remove, eq } = vi.hoisted(() => ({
  state: { error: null as null | { message: string } },
  upsert: vi.fn(),
  remove: vi.fn(),
  eq: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ requireUser: async () => ({ id: 'member-1' }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      expect(table).toBe('team_member_signatures')
      return { upsert, delete: remove }
    },
  }),
}))

import { savePersonalSignature } from './signature-actions'

describe('personal signature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.error = null
    upsert.mockImplementation(async () => ({ error: state.error }))
    remove.mockReturnValue({ eq })
    eq.mockImplementation(async () => ({ error: state.error }))
  })

  it('saves a valid drawing only for the authenticated member', async () => {
    const signature = { version: 1, strokes: [[{ x: 10, y: 20 }]] }
    expect(await savePersonalSignature(signature)).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ member_id: 'member-1', signature }),
    )
  })

  it('deletes only the authenticated member signature when cleared', async () => {
    expect(await savePersonalSignature(null)).toEqual({ ok: true })
    expect(eq).toHaveBeenCalledWith('member_id', 'member-1')
  })

  it('rejects malformed signatures before writing', async () => {
    expect(
      await savePersonalSignature({ version: 1, strokes: [[{ x: 601, y: 0 }]] }),
    ).toMatchObject({
      ok: false,
    })
    expect(upsert).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('reports a database failure', async () => {
    state.error = { message: 'database unavailable' }
    expect(await savePersonalSignature(null)).toMatchObject({ ok: false })
  })
})
