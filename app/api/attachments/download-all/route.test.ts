import { inflateRawSync } from 'node:zlib'

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']
const { state } = vi.hoisted(() => ({
  state: {
    authThrows: false,
    rows: [] as {
      id: string
      name: string
      storage_path: string | null
      size_bytes: number | null
      source: string
    }[],
    queryError: false,
    download: vi.fn(),
    selectedIds: [] as string[],
    deletedFilter: null as unknown,
  },
}))

vi.mock('@/lib/auth', () => ({
  requireUser: async () => {
    if (state.authThrows) throw new Error('auth')
  },
}))
vi.mock('@/lib/storage', () => ({ getStorage: () => ({ download: state.download }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({
        in: (_column: string, values: string[]) => {
          state.selectedIds = values
          return {
            is: async (_column: string, value: unknown) => {
              state.deletedFilter = value
              return { data: state.rows, error: state.queryError ? { message: 'db error' } : null }
            },
          }
        },
      }),
    }),
  }),
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/attachments/download-all', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

function zipEntries(bytes: Buffer) {
  const entries: { name: string; content: string }[] = []
  let offset = 0
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const method = bytes.readUInt16LE(offset + 8)
    const compressedSize = bytes.readUInt32LE(offset + 18)
    const nameLength = bytes.readUInt16LE(offset + 26)
    const extraLength = bytes.readUInt16LE(offset + 28)
    const name = bytes.subarray(offset + 30, offset + 30 + nameLength).toString()
    const start = offset + 30 + nameLength + extraLength
    const body = bytes.subarray(start, start + compressedSize)
    entries.push({ name, content: (method === 8 ? inflateRawSync(body) : body).toString() })
    offset = start + compressedSize
  }
  return entries
}

describe('POST /api/attachments/download-all', () => {
  beforeEach(() => {
    state.authThrows = false
    state.queryError = false
    state.rows = ids.map((id, index) => ({
      id,
      name: '../factura.pdf',
      storage_path: `path-${index}`,
      size_bytes: 4,
      source: 'storage',
    }))
    state.download.mockReset().mockImplementation(async (_bucket: string, path: string) => ({
      data: new TextEncoder().encode(path).buffer,
      error: null,
    }))
  })

  it('requires authentication and validates IDs', async () => {
    state.authThrows = true
    expect((await POST(request({ ids }))).status).toBe(401)
    state.authThrows = false
    expect((await POST(request({ ids: ['not-a-uuid'] }))).status).toBe(400)
  })

  it('returns a ZIP with safe, unique names and the requested file contents', async () => {
    const response = await POST(request({ ids }))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="adjuntos.zip"')
    expect(state.selectedIds).toEqual(ids)
    expect(state.deletedFilter).toBeNull()
    expect(zipEntries(Buffer.from(await response.arrayBuffer()))).toEqual([
      { name: '_factura.pdf', content: 'path-0' },
      { name: '_factura (2).pdf', content: 'path-1' },
    ])
  })

  it('does not return a partial archive for inaccessible or Drive records', async () => {
    state.rows.pop()
    expect((await POST(request({ ids }))).status).toBe(404)
    expect(state.download).not.toHaveBeenCalled()
    const first = state.rows[0]
    if (!first) throw new Error('Missing test attachment')
    first.source = 'drive'
    expect((await POST(request({ ids: [ids[0]] }))).status).toBe(404)
  })

  it('rejects oversized archives and reports storage errors', async () => {
    const first = state.rows[0]
    if (!first) throw new Error('Missing test attachment')
    first.size_bytes = 201 * 1024 * 1024
    expect((await POST(request({ ids }))).status).toBe(413)
    first.size_bytes = 4
    state.download.mockResolvedValue({ data: null, error: 'storage error' })
    expect((await POST(request({ ids }))).status).toBe(500)
  })
})
