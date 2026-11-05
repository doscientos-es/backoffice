import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  results: [] as Array<{ data?: unknown; error?: unknown }>,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {}
      const resolve = () => ({ data: null, error: null, ...db.results.shift() })
      for (const method of ['select', 'eq', 'ilike', 'update', 'insert']) {
        builder[method] = (...args: unknown[]) => {
          db.calls.push({ table, method, args })
          return builder
        }
      }
      builder.maybeSingle = async () => resolve()
      builder.then = (callback: (result: unknown) => unknown) =>
        Promise.resolve(resolve()).then(callback)
      return builder
    },
  }),
}))

import { GET, POST } from './route'

const token = '123e4567-e89b-42d3-a456-426614174000'
const request = new Request('https://example.test/unsubscribe')
const context = (value = token) => ({ params: Promise.resolve({ token: value }) })

beforeEach(() => {
  db.results = []
  db.calls = []
})

describe('baja de emails comerciales', () => {
  it('registra la baja global para el enlace estable', async () => {
    db.results = [{ data: { id: 'contact-1' } }, { data: { id: 'contact-1' } }]
    const response = await GET(request, context())
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('Baja confirmada')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(db.calls).toContainEqual({
      table: 'email_marketing_contacts',
      method: 'update',
      args: [
        expect.objectContaining({ status: 'unsubscribed', unsubscribed_at: expect.any(String) }),
      ],
    })
  })

  it('admite bajas desde envíos antiguos sin contacto previo', async () => {
    db.results = [
      { data: null },
      { data: { id: 'send-1', email: 'Ana@Example.test' } },
      { data: null },
      { data: { id: 'contact-1' } },
      { data: { id: 'contact-1' } },
      {},
    ]
    const response = await POST(request, context())
    expect(response.status).toBe(200)
    expect(db.calls).toContainEqual({
      table: 'email_marketing_contacts',
      method: 'insert',
      args: [expect.objectContaining({ email: 'ana@example.test', status: 'unsubscribed' })],
    })
    expect(db.calls).toContainEqual({
      table: 'lead_campaign_sends',
      method: 'update',
      args: [expect.objectContaining({ unsubscribed_at: expect.any(String) })],
    })
  })

  it('reutiliza el contacto existente de un envío anterior', async () => {
    db.results = [
      { data: null },
      { data: { id: 'send-1', email: 'Ana@Example.test' } },
      { data: { id: 'contact-1' } },
      { data: { id: 'contact-1' } },
      {},
    ]
    expect((await GET(request, context())).status).toBe(200)
    expect(db.calls.some((call) => call.method === 'insert')).toBe(false)
    expect(db.calls).toContainEqual({
      table: 'email_marketing_contacts',
      method: 'ilike',
      args: ['email', 'ana@example.test'],
    })
  })

  it('no confirma la baja si falla la escritura', async () => {
    db.results = [{ data: { id: 'contact-1' } }, { error: { message: 'database failure' } }]
    const response = await GET(request, context())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('Baja confirmada')
  })

  it('rechaza tokens inválidos o desconocidos', async () => {
    expect((await GET(request, context('invalid'))).status).toBe(404)
    expect(db.calls).toHaveLength(0)
    db.results = [{ data: null }, { data: null }]
    expect((await GET(request, context())).status).toBe(404)
  })
})
