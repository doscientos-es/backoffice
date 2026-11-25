import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    doc: { id: 'a1', storage_path: 'path', name: 'foto.jpg' } as {
      id: string
      storage_path: string | null
      name: string
    } | null,
    sign: vi.fn(),
  },
}))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => {
    if (state.authThrows) throw new Error('auth')
  },
}))
vi.mock('@/lib/storage', () => ({ getStorage: () => ({ createSignedUrl: state.sign }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: state.doc, error: null }) }) }),
      }),
    }),
  }),
}))

import { GET } from './route'

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    state.authThrows = false
    state.doc = { id: 'a1', storage_path: 'path', name: 'foto.jpg' }
    state.sign.mockReset().mockResolvedValue({ url: 'https://storage.example/file', error: null })
  })

  it('uses a signed URL that forces a download with the original name', async () => {
    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: 'a1' }),
    })
    expect(response.status).toBe(307)
    expect(state.sign).toHaveBeenCalledWith('documents', 'path', 120, { download: 'foto.jpg' })
    expect(response.headers.get('location')).toBe('https://storage.example/file')
  })

  it('does not sign inaccessible files', async () => {
    state.authThrows = true
    expect(
      (await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'a1' }) }))
        .status,
    ).toBe(401)
    state.authThrows = false
    state.doc = null
    expect(
      (await GET(new NextRequest('http://localhost'), { params: Promise.resolve({ id: 'a1' }) }))
        .status,
    ).toBe(404)
    expect(state.sign).not.toHaveBeenCalled()
  })
})
