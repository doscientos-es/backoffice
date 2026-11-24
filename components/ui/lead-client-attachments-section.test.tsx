import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ filters: [] as string[], error: null as string | null }))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      expect(table).toBe('attachments')
      const query = {
        select: () => query,
        is: (column: string, value: null) => {
          state.filters.push(`${column}:${value}`)
          return query
        },
        eq: (column: string, value: string) => {
          state.filters.push(`${column}:${value}`)
          return query
        },
        or: (filter: string) => {
          state.filters.push(filter)
          return query
        },
        order: async () => ({
          data: [{ id: 'attachment-1' }],
          error: state.error ? { message: state.error } : null,
        }),
      }
      return query
    },
  }),
}))

import { LeadClientAttachmentsSection } from './lead-client-attachments-section'

beforeEach(() => {
  state.filters = []
  state.error = null
})

describe('shared lead and client attachments', () => {
  it.each(['lead', 'client'] as const)(
    'reads both sides and uploads against the %s',
    async (entityType) => {
      const section = await LeadClientAttachmentsSection({
        leadId: 'lead-1',
        clientId: 'client-1',
        entityType,
        canEdit: true,
      })
      expect(state.filters).toEqual(['deleted_at:null', 'lead_id.eq.lead-1,client_id.eq.client-1'])
      expect(section.props).toMatchObject({
        entityType,
        entityId: entityType === 'lead' ? 'lead-1' : 'client-1',
        attachments: [{ id: 'attachment-1' }],
        canEdit: true,
      })
    },
  )

  it.each(['lead', 'client'] as const)(
    'limits an unlinked %s to its own attachments',
    async (entityType) => {
      await LeadClientAttachmentsSection({
        leadId: entityType === 'lead' ? 'lead-1' : null,
        clientId: entityType === 'client' ? 'client-1' : null,
        entityType,
        canEdit: false,
      })
      expect(state.filters).toEqual(['deleted_at:null', `${entityType}_id:${entityType}-1`])
    },
  )

  it('reports a query error rather than showing an empty list', async () => {
    state.error = 'database unavailable'
    await expect(
      LeadClientAttachmentsSection({
        leadId: 'lead-1',
        clientId: null,
        entityType: 'lead',
        canEdit: false,
      }),
    ).rejects.toThrow('database unavailable')
  })
})
