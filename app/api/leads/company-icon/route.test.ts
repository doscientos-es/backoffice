import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ role: 'member', authenticated: true }))
vi.mock('@/lib/auth', () => ({
  requireUser: async () => {
    if (!state.authenticated) throw new Error('not authenticated')
    return { role: state.role }
  },
}))

import { GET } from './route'

const request = (domain: string) =>
  new Request(`http://localhost/api/leads/company-icon?domain=${encodeURIComponent(domain)}`)

describe('company icon route', () => {
  beforeEach(() => {
    state.role = 'member'
    state.authenticated = true
  })
  afterEach(() => vi.unstubAllGlobals())

  it('requires authentication and lead access before fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    state.authenticated = false
    await expect(GET(request('example.test'))).rejects.toThrow('not authenticated')
    state.authenticated = true
    state.role = 'accountant'
    expect((await GET(request('example.test'))).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-corporate and malformed domains before fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const domain of ['gmail.com', 'example.test/path', '127.0.0.1']) {
      expect((await GET(request(domain))).status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the image only when the provider finds one', async () => {
    const fetchMock = vi
      .fn<(url: URL) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }),
      )
      .mockResolvedValueOnce(
        new Response('missing', { status: 404, headers: { 'Content-Type': 'image/png' } }),
      )
    vi.stubGlobal('fetch', fetchMock)
    const result = await GET(request('example.test'))
    expect(result.status).toBe(200)
    expect(result.headers.get('content-type')).toBe('image/png')
    expect(Array.from(new Uint8Array(await result.arrayBuffer()))).toEqual([1, 2, 3])
    expect(fetchMock.mock.calls[0]?.[0].searchParams.get('domain')).toBe('example.test')
    expect((await GET(request('example.test'))).status).toBe(404)
  })
})
