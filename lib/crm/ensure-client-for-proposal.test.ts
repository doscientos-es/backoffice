import { describe, expect, it } from 'vitest'

import { ensureClientForProposal } from '@/lib/crm/conversion'

type Result = { data: unknown; error: { code?: string; message: string } | null }
type Client = Parameters<typeof ensureClientForProposal>[0]

const fiscal = { name: 'Test', nif: 'B123', billing_address: 'Test street' }
const proposal = { client_id: null, lead_id: 'lead-1', project_id: null }

function makeClient(results: Result[]) {
  const calls: { table: string; operation: string; value?: unknown }[] = []
  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        is: (column: string, value: unknown) => {
          calls.push({ table, operation: `is:${column}`, value })
          return chain
        },
        eq: (column: string, value: unknown) => {
          calls.push({ table, operation: `eq:${column}`, value })
          return chain
        },
        maybeSingle: async () => results.shift(),
        single: async () => results.shift(),
        insert: (value: unknown) => {
          calls.push({ table, operation: 'insert', value })
          return chain
        },
        update: (value: unknown) => {
          calls.push({ table, operation: 'update', value })
          return { eq: async () => results.shift() }
        },
      }
      return chain
    },
  }
  return { client: client as unknown as Client, calls }
}

describe('ensureClientForProposal', () => {
  it('creates and links a fiscal record when the lead has none', async () => {
    const { client, calls } = makeClient([
      { data: proposal, error: null },
      { data: null, error: null },
      { data: { id: 'client-1' }, error: null },
      { data: null, error: null },
    ])
    await expect(ensureClientForProposal(client, 'proposal-1', fiscal)).resolves.toEqual({
      clientId: 'client-1',
      created: true,
    })
    expect(calls).toContainEqual({
      table: 'proposals',
      operation: 'update',
      value: { client_id: 'client-1', lead_id: null },
    })
  })

  it('reuses a fiscal record created concurrently for the same lead', async () => {
    const { client, calls } = makeClient([
      { data: proposal, error: null },
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate' } },
      { data: { id: 'client-1' }, error: null },
      { data: { nif: null, billing_address_street: null }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ])

    await expect(ensureClientForProposal(client, 'proposal-1', fiscal)).resolves.toEqual({
      clientId: 'client-1',
      created: false,
    })
    expect(calls).toContainEqual({
      table: 'proposals',
      operation: 'update',
      value: { client_id: 'client-1', lead_id: null },
    })
    expect(
      calls.filter((call) => call.table === 'clients' && call.operation === 'eq:lead_id'),
    ).toEqual([
      { table: 'clients', operation: 'eq:lead_id', value: 'lead-1' },
      { table: 'clients', operation: 'eq:lead_id', value: 'lead-1' },
    ])
  })

  it('does not create a fiscal record when the lookup fails', async () => {
    const { client, calls } = makeClient([
      { data: proposal, error: null },
      { data: null, error: { message: 'unavailable' } },
    ])
    await expect(ensureClientForProposal(client, 'proposal-1', fiscal)).resolves.toEqual({
      error: 'No se pudo consultar la ficha de facturación',
    })
    expect(
      calls.filter((call) => call.operation === 'insert' || call.operation === 'update'),
    ).toEqual([])
  })

  it('does not hide an unrelated unique violation when no record exists for the lead', async () => {
    const { client, calls } = makeClient([
      { data: proposal, error: null },
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'duplicate' } },
      { data: null, error: null },
    ])
    await expect(ensureClientForProposal(client, 'proposal-1', fiscal)).resolves.toEqual({
      error: 'duplicate',
    })
    expect(
      calls.filter((call) => call.table === 'proposals' && call.operation === 'update'),
    ).toEqual([])
  })

  it('stops if the associated project cannot be read', async () => {
    const { client, calls } = makeClient([
      { data: { ...proposal, project_id: 'project-1' }, error: null },
      { data: null, error: { message: 'unavailable' } },
    ])
    await expect(ensureClientForProposal(client, 'proposal-1', fiscal)).resolves.toEqual({
      error: 'No se pudo consultar el proyecto de la propuesta',
    })
    expect(
      calls.filter((call) => call.operation === 'insert' || call.operation === 'update'),
    ).toEqual([])
  })
})
