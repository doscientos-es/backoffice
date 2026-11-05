import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: null as null | {
    id: string
    clicked_at: string | null
    click_count: number
    lead_id: string | null
    resend_email_id: string | null
  },
  update: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === 'lead_campaign_sends'
        ? {
            select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.row }) }) }),
            update: state.update,
          }
        : { insert: state.insert },
  }),
}))

import { GET } from './route'

const token = '123e4567-e89b-42d3-a456-426614174000'
const context = (value = token) => ({ params: Promise.resolve({ token: value }) })

beforeEach(() => {
  state.row = {
    id: 'send-1',
    clicked_at: null,
    click_count: 0,
    lead_id: null,
    resend_email_id: 'mail-1',
  }
  state.update.mockReset().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  state.insert.mockReset().mockResolvedValue({ error: null })
})

describe('seguimiento de clics', () => {
  it('mantiene enlaces existentes y registra la URL de destino', async () => {
    const request = new NextRequest(
      'https://example.test/api/track/click/token?url=https%3A%2F%2Fexample.test%2Fpage',
    )
    const response = await GET(request, context())
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://example.test/page')
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ click_count: 1 }))
    expect(state.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        resend_email_id: 'mail-1',
        payload: expect.objectContaining({
          click: expect.objectContaining({ link: 'https://example.test/page' }),
        }),
      }),
    )
  })

  it('rechaza tokens inexistentes sin registrar clics', async () => {
    state.row = null
    const response = await GET(new NextRequest('https://example.test'), context())
    expect(response.status).toBe(404)
    expect(state.update).not.toHaveBeenCalled()
    expect(state.insert).not.toHaveBeenCalled()
  })
})
