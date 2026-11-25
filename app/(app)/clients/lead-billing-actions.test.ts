import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  role: 'member',
  accessScope: 'all',
  lead: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  leadError: null as { message: string } | null,
  insertError: null as { code: string; message: string } | null,
  visibleClient: true,
  inserted: [] as Record<string, unknown>[],
  verify: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireRole: async (roles: string[]) => {
    if (!roles.includes(state.role)) throw new Error('Sin permiso')
    return { id: 'member-1', role: state.role, accessScope: state.accessScope }
  },
  requireUser: vi.fn(),
}))
vi.mock('@/lib/clients/fiscal-verification', () => ({
  validateAndRecordClientFiscalIdentity: state.verify,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      if (table === 'leads') {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          maybeSingle: async () => ({ data: state.lead, error: state.leadError }),
        }
        return query
      }
      if (table !== 'clients') throw new Error('Unexpected table')
      return {
        select: () => {
          const query = {
            eq: () => query,
            is: () => query,
            maybeSingle: async () => ({
              data: state.visibleClient ? { id: 'client-1' } : null,
              error: null,
            }),
          }
          return query
        },
        insert: (record: Record<string, unknown>) => {
          state.inserted.push(record)
          return {
            select: () => ({
              single: async () => ({
                data: state.insertError ? null : { id: 'client-1' },
                error: state.insertError,
              }),
            }),
          }
        },
      }
    },
  }),
}))

import { createLeadBilling, validateClientFiscalIdentity } from './actions'

const leadId = '11111111-1111-4111-8111-111111111111'

describe('createLeadBilling', () => {
  beforeEach(() => {
    state.role = 'member'
    state.accessScope = 'all'
    state.lead = { id: leadId }
    state.leadError = null
    state.insertError = null
    state.visibleClient = true
    state.inserted = []
    state.verify.mockReset()
  })

  it('creates a linked billing record without changing the lead status', async () => {
    const result = await createLeadBilling({
      leadId,
      name: 'Empresa ficticia',
      logo_url: 'https://example.test/logo.png',
    })
    expect(result).toEqual({ ok: true, clientId: 'client-1' })
    expect(state.inserted).toMatchObject([
      { lead_id: leadId, name: 'Empresa ficticia', logo_url: 'https://example.test/logo.png' },
    ])
    expect(state.verify).not.toHaveBeenCalled()
  })

  it('verifies a Spanish fiscal identity after saving it', async () => {
    await createLeadBilling({ leadId, name: 'Empresa ficticia', nif: 'B12345678' })
    expect(state.verify).toHaveBeenCalledWith('client-1', 'member-1')
  })

  it('does not overwrite an existing billing identity on a concurrent request', async () => {
    state.insertError = { code: '23505', message: 'duplicate key' }
    const result = await createLeadBilling({ leadId, name: 'Empresa ficticia' })
    expect(result).toEqual({
      ok: false,
      error: 'Ya existen datos de facturación para este lead. Recarga la ficha.',
    })
    expect(state.verify).not.toHaveBeenCalled()
  })

  it('rejects viewers and missing leads before inserting', async () => {
    state.role = 'viewer'
    expect((await createLeadBilling({ leadId, name: 'Ejemplo' })).ok).toBe(false)
    state.role = 'member'
    state.lead = null
    expect(await createLeadBilling({ leadId, name: 'Ejemplo' })).toEqual({
      ok: false,
      error: 'Lead no encontrado',
    })
    expect(state.inserted).toEqual([])
  })

  it('rejects assigned-only users without exposing or creating billing data', async () => {
    state.accessScope = 'assigned'
    expect(await createLeadBilling({ leadId, name: 'Ejemplo' })).toEqual({
      ok: false,
      error: 'No tienes acceso a los datos de facturación.',
    })
    expect(state.inserted).toEqual([])
  })

  it('checks client access before calling the privileged AEAT verification', async () => {
    const clientId = '22222222-2222-4222-8222-222222222222'
    state.role = 'sales'
    state.visibleClient = false
    expect(await validateClientFiscalIdentity({ clientId })).toEqual({
      ok: false,
      error: 'Cliente no encontrado',
    })
    expect(state.verify).not.toHaveBeenCalled()
    state.visibleClient = true
    state.verify.mockResolvedValue({ status: 'verified', aeatName: null, message: 'Validado' })
    expect((await validateClientFiscalIdentity({ clientId })).ok).toBe(true)
    expect(state.verify).toHaveBeenCalledWith(clientId, 'member-1')
  })
})
