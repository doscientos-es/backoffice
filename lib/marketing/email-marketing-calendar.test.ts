import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  calls: [] as { method: string; args: unknown[] }[],
  error: null as null | { message: string },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from(table: string) {
      state.calls.push({ method: 'from', args: [table] })
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'is', 'gte', 'lt', 'order']) {
        builder[method] = (...args: unknown[]) => {
          state.calls.push({ method, args })
          return builder
        }
      }
      builder.range = async (...args: unknown[]) => {
        state.calls.push({ method: 'range', args })
        return {
          error: state.error,
          data: [
            {
              id: 'step-1',
              title: 'Hola',
              scheduled_at: '2026-03-31T22:30:00Z',
              status: 'scheduled',
              sequence: {
                id: 'seq-1',
                list_id: 'list-1',
                name: 'Secuencia',
                status: 'active',
                list: { name: 'Lista' },
              },
            },
          ],
        }
      }
      return builder
    },
  }),
}))

import { getEmailMarketingCalendar } from './email-marketing-calendar'

beforeEach(() => {
  state.calls = []
  state.error = null
})

describe('consulta del calendario', () => {
  it('consulta solo pasos del mes con margen para el horario de Madrid', async () => {
    const result = await getEmailMarketingCalendar(2026, 4)
    expect(state.calls).toContainEqual({ method: 'from', args: ['email_marketing_sequence_steps'] })
    expect(state.calls).toContainEqual({ method: 'is', args: ['sequence.deleted_at', null] })
    expect(state.calls).toContainEqual({
      method: 'gte',
      args: ['scheduled_at', '2026-03-31T00:00:00.000Z'],
    })
    expect(state.calls).toContainEqual({
      method: 'lt',
      args: ['scheduled_at', '2026-05-01T00:00:00.000Z'],
    })
    expect(result[0]).toMatchObject({
      step: { id: 'step-1' },
      sequence: { id: 'seq-1', list_name: 'Lista' },
    })
  })

  it('propaga errores de la consulta', async () => {
    state.error = { message: 'database failure' }
    await expect(getEmailMarketingCalendar(2026, 4)).rejects.toThrow('database failure')
  })
})
