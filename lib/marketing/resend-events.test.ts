import { describe, expect, it, vi } from 'vitest'

import { getResendActivity } from './resend-events'

describe('historial de interacción de Resend', () => {
  it('recupera aperturas y enlaces únicos, incluso detrás del redirect de tracking', async () => {
    const rows = [
      {
        resend_email_id: 'mail-1',
        type: 'email_opened',
        created_at: '2026-01-01T10:00:00Z',
        payload: {},
      },
      {
        resend_email_id: 'mail-1',
        type: 'email_clicked',
        created_at: '2026-01-01T11:00:00Z',
        payload: {
          click: { link: 'https://example.test/page', timestamp: '2026-01-01T10:59:00Z' },
        },
      },
      {
        resend_email_id: 'mail-1',
        type: 'email_clicked',
        created_at: '2026-01-01T11:01:00Z',
        payload: {
          click: {
            link: 'https://example.test/api/track/click/test?url=https%3A%2F%2Fexample.test%2Fpage',
          },
        },
      },
      {
        resend_email_id: 'mail-2',
        type: 'email_clicked',
        created_at: '2026-01-01T11:00:00Z',
        payload: { click: { link: 'javascript:alert(1)' } },
      },
    ]
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'in', 'order']) builder[method] = vi.fn(() => builder)
    builder.range = vi.fn(async () => ({ data: rows, error: null }))
    const client = { from: vi.fn(() => builder) } as never
    const activity = await getResendActivity(client, ['mail-1', 'mail-2', 'mail-1'])
    expect(activity.get('mail-1')).toEqual({
      openedAt: '2026-01-01T10:00:00Z',
      clickedAt: '2026-01-01T10:59:00Z',
      links: ['https://example.test/page'],
    })
    expect(activity.get('mail-2')?.links).toEqual([])
  })

  it('propaga errores de consulta en vez de mostrar estadísticas vacías', async () => {
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'in', 'order']) builder[method] = () => builder
    builder.range = async () => ({ data: null, error: { message: 'database failure' } })
    await expect(getResendActivity({ from: () => builder } as never, ['mail-1'])).rejects.toThrow(
      'database failure',
    )
  })

  it('consulta lotes en paralelo con un máximo de cuatro simultáneos', async () => {
    let active = 0
    let maximum = 0
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'in', 'order']) builder[method] = () => builder
    builder.range = vi.fn(async () => {
      active++
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active--
      return { data: [], error: null }
    })
    await getResendActivity(
      { from: () => builder } as never,
      Array.from({ length: 1001 }, (_, index) => `mail-${index}`),
    )
    expect(builder.range).toHaveBeenCalledTimes(6)
    expect(maximum).toBe(4)
  })
})
