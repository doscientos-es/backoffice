import { describe, expect, it } from 'vitest'

import { buildAssistantSources, resolveAssistantSources } from './assistant-context'
import type { HistoryItem } from './assistant-contract'
import type { LeadDetailResult } from './types'

const LEAD_ID = '00000000-0000-4000-8000-000000000001'
const INTERACTION_ID = '00000000-0000-4000-8000-000000000002'
function syntheticDetail(): LeadDetailResult {
  return {
    lead: {
      id: LEAD_ID,
      name: 'Synthetic Lead',
      status: 'lost',
      notes: 'Confirmed need',
      estimated_value: 4321,
    },
    proposals: [{ id: 'proposal-1', title: 'Synthetic Proposal', total: 8765 }],
    invoices: [{ id: 'invoice-1', full_number: 'TEST-1', total: 9876 }],
    tasks: [],
    projects: [],
    reminders: [],
    discoveryQuestions: [],
  } as unknown as LeadDetailResult
}

const interaction: HistoryItem = {
  id: INTERACTION_ID,
  type: 'meeting',
  subject: 'Old meeting',
  body: '<p>Confirmed need</p>',
  summary: 'Budget agreed',
  created_at: '2022-01-01T00:00:00Z',
  truncated: false,
}

describe('lead assistant context', () => {
  it('includes old meeting evidence, source date, stable link and no HTML or raw payloads', () => {
    const sources = buildAssistantSources(syntheticDetail(), [interaction, interaction], {
      prices: false,
      finance: false,
    })
    const meetings = sources.filter((s) => s.id === `interaction:${INTERACTION_ID}`)
    expect(meetings).toHaveLength(1)
    expect(meetings[0]).toMatchObject({
      createdAt: interaction.created_at,
      href: `/leads/${LEAD_ID}/history/${INTERACTION_ID}`,
    })
    expect(meetings[0]?.content).toContain('Budget agreed')
    expect(meetings[0]?.content).not.toContain('<p>')
  })

  it('omits financial sources and price fields without the corresponding permissions', () => {
    const sources = buildAssistantSources(syntheticDetail(), [], { prices: false, finance: false })
    const json = JSON.stringify(sources)
    expect(json).not.toContain('invoice-1')
    expect(json).not.toContain('4321')
    expect(json).not.toContain('8765')
    const privileged = JSON.stringify(
      buildAssistantSources(syntheticDetail(), [], { prices: true, finance: true }),
    )
    expect(privileged).toContain('8765')
    expect(privileged).toContain('9876')
  })

  it('caps the source budget and resolves citations only from the actual retained sources', () => {
    const sources = buildAssistantSources(
      syntheticDetail(),
      Array.from({ length: 100 }, (_, i) => ({
        ...interaction,
        id: `id-${i}`,
        summary: 'x'.repeat(8000),
      })),
      { prices: false, finance: false },
    )
    expect(JSON.stringify(sources).length).toBeLessThan(40_100)
    expect(sources.length).toBeLessThan(100)
    const cited = resolveAssistantSources([sources[0]!.id, sources[0]!.id], sources)
    expect(cited).toHaveLength(1)
    expect(cited[0]).not.toHaveProperty('content')
    expect(() => resolveAssistantSources(['invented'], sources)).toThrow('Unknown assistant source')
  })
})
