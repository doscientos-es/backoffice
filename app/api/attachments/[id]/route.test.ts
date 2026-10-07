import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    userRole: 'member' as 'owner' | 'admin' | 'member' | 'viewer',
    attachment: { id: 'att-1', storage_path: 'expense/expense-1/att-1/invoice.pdf' } as {
      id: string
      storage_path: string | null
    } | null,
    fetchError: null as { message: string } | null,
    updateResult: { data: { id: 'att-1' }, error: null } as {
      data: { id: string } | null
      error: { message: string } | null
    },
    updateValues: null as Record<string, unknown> | null,
    storageRemove: vi.fn(async () => ({ error: null as string | null })),
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('Not authenticated')
    return { id: 'user-1', role: state.userRole }
  }),
}))

vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
}))

vi.mock('@/lib/storage', () => ({
  getStorage: () => ({ remove: state.storageRemove }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: async () => ({ data: state.attachment, error: state.fetchError }),
          }),
        }),
      }),
      update: (values: Record<string, unknown>) => {
        state.updateValues = values
        return {
          eq: () => ({
            is: () => ({
              select: () => ({ maybeSingle: async () => state.updateResult }),
            }),
          }),
        }
      },
    }),
  })),
}))

import { NextRequest } from 'next/server'

import { DELETE } from '@/app/api/attachments/[id]/route'

function deleteRequest(): NextRequest {
  return new NextRequest('http://localhost/api/attachments/att-1', { method: 'DELETE' })
}

describe('DELETE /api/attachments/[id]', () => {
  beforeEach(() => {
    state.authThrows = false
    state.userRole = 'member'
    state.attachment = { id: 'att-1', storage_path: 'expense/expense-1/att-1/invoice.pdf' }
    state.fetchError = null
    state.updateResult = { data: { id: 'att-1' }, error: null }
    state.updateValues = null
    state.storageRemove.mockReset()
    state.storageRemove.mockResolvedValue({ error: null })
  })

  it('requires an authenticated user', async () => {
    state.authThrows = true
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'att-1' }) })
    expect(response.status).toBe(401)
  })

  it('does not allow viewers to remove attachments', async () => {
    state.userRole = 'viewer'
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'att-1' }) })
    expect(response.status).toBe(403)
  })

  it('returns 404 when the attachment does not exist or is already deleted', async () => {
    state.attachment = null
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'att-1' }) })
    expect(response.status).toBe(404)
  })

  it('soft-deletes the attachment and removes its stored file', async () => {
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'att-1' }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(state.updateValues).toEqual({ deleted_at: expect.any(String) })
    expect(state.storageRemove).toHaveBeenCalledWith('documents', [
      'expense/expense-1/att-1/invoice.pdf',
    ])
  })

  it('keeps the original Drive file when removing a Drive reference', async () => {
    state.attachment = { id: 'att-1', storage_path: null }
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'att-1' }) })

    expect(response.status).toBe(200)
    expect(state.storageRemove).not.toHaveBeenCalled()
  })

  it('returns an error when the database update fails', async () => {
    state.updateResult = { data: null, error: { message: 'database failure' } }
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'att-1' }) })

    expect(response.status).toBe(500)
    expect(state.storageRemove).not.toHaveBeenCalled()
  })
})
