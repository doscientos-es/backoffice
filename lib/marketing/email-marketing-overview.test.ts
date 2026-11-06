import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
  rangeGate: null as Promise<void> | null,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from(table: string) {
      const builder: Record<string, unknown> = {}
      for (const method of ['select', 'is', 'order', 'eq', 'in']) {
        builder[method] = (...args: unknown[]) => {
          state.calls.push({ table, method, args })
          return builder
        }
      }
      const result = () => ({
        error: null,
        data:
          table === 'email_marketing_lists'
            ? [{ id: 'list-1', name: 'Lista', description: null, created_at: '2026-01-01' }]
            : table === 'email_marketing_sequences'
              ? [
                  {
                    id: 'sequence-1',
                    list_id: 'list-1',
                    name: 'Secuencia',
                    status: 'active',
                    created_at: '2026-01-01',
                    list: { name: 'Lista' },
                    steps: [{ id: 'step-1', scheduled_at: '2026-01-01' }],
                  },
                ]
              : table === 'email_marketing_list_members'
                ? [
                    { list_id: 'list-1', contact: { status: 'subscribed' } },
                    { list_id: 'list-1', contact: { status: 'unsubscribed' } },
                  ]
                : [],
      })
      builder.range = async (...args: unknown[]) => {
        state.calls.push({ table, method: 'range', args })
        if (state.rangeGate) await state.rangeGate
        return result()
      }
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve)
      return builder
    },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('./resend-events', () => ({ getResendActivity: async () => new Map() }))
vi.mock('./privacy-url', () => ({ MARKETING_PRIVACY_URL: 'https://example.test/privacy' }))

import { getEmailMarketingOverview } from './email-marketing'

beforeEach(() => {
  state.calls = []
  state.rangeGate = null
})

describe('carga de email marketing', () => {
  it('limita los datos a la lista y evita consultar estadísticas no utilizadas', async () => {
    const result = await getEmailMarketingOverview({ listId: 'list-1', includeStats: false })
    expect(result.lists[0]?.contact_count).toBe(1)
    expect(state.calls).toContainEqual({
      table: 'email_marketing_lists',
      method: 'eq',
      args: ['id', 'list-1'],
    })
    expect(state.calls).toContainEqual({
      table: 'email_marketing_sequences',
      method: 'eq',
      args: ['list_id', 'list-1'],
    })
    expect(state.calls.some((call) => call.table === 'lead_campaign_sends')).toBe(false)
  })

  it('limita las estadísticas a los pasos de la secuencia solicitada', async () => {
    await getEmailMarketingOverview({ listId: 'list-1', sequenceId: 'sequence-1' })
    expect(state.calls).toContainEqual({
      table: 'email_marketing_sequences',
      method: 'eq',
      args: ['id', 'sequence-1'],
    })
    expect(state.calls).toContainEqual({
      table: 'lead_campaign_sends',
      method: 'in',
      args: ['sequence_step_id', ['step-1']],
    })
  })

  it('consulta los contactos y las estadísticas en paralelo', async () => {
    let release!: () => void
    state.rangeGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const loading = getEmailMarketingOverview()
    try {
      await vi.waitFor(() => {
        expect(state.calls).toContainEqual({
          table: 'email_marketing_list_members',
          method: 'range',
          args: [0, 999],
        })
        expect(state.calls).toContainEqual({
          table: 'lead_campaign_sends',
          method: 'range',
          args: [0, 999],
        })
      })
    } finally {
      release()
      await loading
    }
  })
})
