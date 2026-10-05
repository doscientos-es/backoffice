import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authThrows: false,
  role: 'member',
  doc: {
    id: 'doc-1',
    name: 'Guía.pdf',
    storage_path: 'policies/doc-1/guide.pdf',
    visibility: 'all_team',
    deleted_at: null as string | null,
  } as {
    id: string
    name: string
    storage_path: string
    visibility: string
    deleted_at: string | null
  } | null,
  dbError: null as { message: string } | null,
  createSignedUrl: vi.fn(),
  log: { error: vi.fn() },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => {
    if (mocks.authThrows) throw new Error('Not authenticated')
    return { id: 'user-1', role: mocks.role }
  }),
}))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => mocks.log }))
vi.mock('@/lib/storage', () => ({
  getStorage: () => ({ createSignedUrl: mocks.createSignedUrl }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mocks.doc, error: mocks.dbError }) }),
      }),
    }),
  })),
}))

import { NextRequest } from 'next/server'

import { GET } from './route'

function downloadRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/internal-docs/${id}/download`)
}

describe('GET /api/internal-docs/[id]/download', () => {
  beforeEach(() => {
    mocks.authThrows = false
    mocks.role = 'member'
    mocks.doc = {
      id: 'doc-1',
      name: 'Guía.pdf',
      storage_path: 'policies/doc-1/guide.pdf',
      visibility: 'all_team',
      deleted_at: null,
    }
    mocks.dbError = null
    mocks.createSignedUrl.mockReset()
    mocks.createSignedUrl.mockResolvedValue({ url: 'https://storage.example/signed', error: null })
  })

  it('requires an authenticated user', async () => {
    mocks.authThrows = true

    const response = await GET(downloadRequest('doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(401)
  })

  it('prevents non-admins from downloading admin-only documents', async () => {
    mocks.doc = { ...mocks.doc!, visibility: 'admins_only' }

    const response = await GET(downloadRequest('doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(403)
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })

  it('redirects to a signed URL configured to download the file', async () => {
    const response = await GET(downloadRequest('doc-1'), {
      params: Promise.resolve({ id: 'doc-1' }),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://storage.example/signed')
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      'internal-docs',
      'policies/doc-1/guide.pdf',
      120,
      { download: true },
    )
  })
})
