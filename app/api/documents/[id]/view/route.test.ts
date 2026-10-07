import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    attachment: {
      id: 'att-1',
      storage_path: 'expense/expense-1/att-1/factura.pdf',
      name: 'factura ñ.pdf',
      mime_type: 'application/pdf',
    } as { id: string; storage_path: string; name: string; mime_type: string } | null,
    downloadData: new TextEncoder().encode('pdf preview').buffer as ArrayBuffer,
    downloadError: null as string | null,
    storageDownload: vi.fn(async () => ({ data: state.downloadData, error: state.downloadError })),
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (state.authThrows) throw new Error('Not authenticated')
    return { id: 'user-1', role: 'member' }
  }),
}))

vi.mock('@/lib/storage', () => ({
  getStorage: () => ({ download: state.storageDownload }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({ maybeSingle: async () => ({ data: state.attachment, error: null }) }),
        }),
      }),
    }),
  })),
}))

import { NextRequest } from 'next/server'

import { GET } from '@/app/api/documents/[id]/view/route'

function viewRequest(id = 'att-1'): NextRequest {
  return new NextRequest(`http://localhost/api/documents/${id}/view`)
}

describe('GET /api/documents/[id]/view', () => {
  beforeEach(() => {
    state.authThrows = false
    state.attachment = {
      id: 'att-1',
      storage_path: 'expense/expense-1/att-1/factura.pdf',
      name: 'factura ñ.pdf',
      mime_type: 'application/pdf',
    }
    state.downloadData = new TextEncoder().encode('pdf preview').buffer as ArrayBuffer
    state.downloadError = null
    state.storageDownload.mockReset()
    state.storageDownload.mockImplementation(async () => ({
      data: state.downloadData,
      error: state.downloadError,
    }))
  })

  it('requires an authenticated user', async () => {
    state.authThrows = true
    const response = await GET(viewRequest(), { params: Promise.resolve({ id: 'att-1' }) })
    expect(response.status).toBe(401)
  })

  it('returns a viewable document inline instead of redirecting to a download', async () => {
    const response = await GET(viewRequest(), { params: Promise.resolve({ id: 'att-1' }) })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-disposition')).toContain('inline;')
    expect(response.headers.get('content-disposition')).toContain('factura%20%C3%B1.pdf')
    expect(await response.text()).toBe('pdf preview')
    expect(state.storageDownload).toHaveBeenCalledWith(
      'documents',
      'expense/expense-1/att-1/factura.pdf',
    )
  })

  it('keeps unsupported file types on the download route', async () => {
    state.attachment = { ...state.attachment!, mime_type: 'application/msword' }
    const response = await GET(viewRequest(), { params: Promise.resolve({ id: 'att-1' }) })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/api/documents/att-1/download')
    expect(state.storageDownload).not.toHaveBeenCalled()
  })
})
