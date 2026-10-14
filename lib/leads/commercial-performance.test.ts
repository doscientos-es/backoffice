import { describe, expect, it } from 'vitest'

import {
  buildCommercialPerformance,
  formatDuration,
  type PerformanceLead,
  type PerformanceProposal,
  summarizeDurations,
} from './commercial-performance'

const now = new Date('2026-08-20T00:00:00Z')
const lead: PerformanceLead = {
  id: 'lead-1',
  assigned_to: 'sales-1',
  status: 'quoted',
  created_at: '2026-08-01T00:00:00Z',
  first_contacted_at: '2026-08-01T02:00:00Z',
}
const proposal: PerformanceProposal = {
  id: 'proposal-1',
  lead_id: 'lead-1',
  created_by: 'sales-2',
  status: 'accepted',
  created_at: '2026-08-02T00:00:00Z',
  sent_at: '2026-08-03T00:00:00Z',
  viewed_at: '2026-08-03T02:00:00Z',
  responded_at: '2026-08-05T00:00:00Z',
  delivered_at: '2026-08-10T00:00:00Z',
  total: 1000,
}
const input = {
  leads: [lead],
  proposals: [proposal],
  interactions: [],
  reminders: [],
  members: [
    { id: 'sales-1', name: 'Responsable' },
    { id: 'sales-2', name: 'Autor' },
  ],
  since: '2026-08-01',
  until: '2026-08-10',
  now,
}

describe('summarizeDurations', () => {
  it('reports mean, interpolated median and nearest-rank P90 with sample size', () => {
    const pairs: [string, string][] = [0, 2, 4, 100].map((hours) => [
      '2026-08-01T00:00:00Z',
      new Date(Date.parse('2026-08-01T00:00:00Z') + hours * 3_600_000).toISOString(),
    ])
    expect(summarizeDurations(pairs, now)).toEqual({
      count: 4,
      missing: 0,
      invalid: 0,
      meanHours: 26.5,
      medianHours: 3,
      p90Hours: 100,
    })
  })

  it('does not invent zeros for missing, reversed, malformed or future dates', () => {
    expect(
      summarizeDurations(
        [
          [null, null],
          ['2026-08-01', null],
          ['not-a-date', '2026-08-03'],
          ['2026-08-03', '2026-08-02'],
          ['2026-08-01', '2026-08-21'],
        ],
        now,
      ),
    ).toEqual({
      count: 0,
      missing: 2,
      invalid: 3,
      meanHours: null,
      medianHours: null,
      p90Hours: null,
    })
  })

  it('formats short, daily and missing durations without treating null as zero', () => {
    expect(formatDuration(null)).toBe('Sin datos')
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(0.5)).toBe('30 min')
    expect(formatDuration(2)).toBe('2 h')
    expect(formatDuration(48)).toBe('2 días')
  })
})

describe('buildCommercialPerformance', () => {
  it('distinguishes lead-to-send, draft-to-send, acceptance and signed delivery', () => {
    const result = buildCommercialPerformance(input)
    expect(result.timing.firstContact.meanHours).toBe(2)
    expect(result.timing.leadToProposal.meanHours).toBe(48)
    expect(result.timing.preparation.meanHours).toBe(24)
    expect(result.timing.firstView.meanHours).toBe(2)
    expect(result.timing.acceptance.meanHours).toBe(48)
    expect(result.timing.delivery.meanHours).toBe(120)
    expect(result.acceptanceRate).toBe(100)
    expect(result.acceptedValue).toBe(1000)
  })

  it('includes later sends in lead timing but not in the proposal-created cohort', () => {
    const later = {
      ...proposal,
      created_at: '2026-08-11T00:00:00Z',
      sent_at: '2026-08-12T00:00:00Z',
    }
    const result = buildCommercialPerformance({ ...input, proposals: [later] })
    expect(result.proposalCount).toBe(0)
    expect(result.timing.leadToProposal.meanHours).toBe(264)
    expect(result.acceptanceRate).toBeNull()
  })

  it('uses the earliest proposal and deduplicates proposal and interaction IDs', () => {
    const event = {
      id: 'call-1',
      lead_id: lead.id,
      performed_by: 'sales-1',
      type: 'call',
      created_at: '2026-08-02T00:00:00Z',
      payload: null,
    }
    const result = buildCommercialPerformance({
      ...input,
      proposals: [
        proposal,
        proposal,
        { ...proposal, id: 'proposal-2', sent_at: '2026-08-04T00:00:00Z' },
      ],
      interactions: [event, event],
    })
    expect(result.sent).toBe(2)
    expect(result.calls).toBe(1)
    expect(result.timing.leadToProposal.meanHours).toBe(48)
  })

  it('keeps manual acceptance and pending wait out of acceptance duration', () => {
    const result = buildCommercialPerformance({
      ...input,
      proposals: [
        { ...proposal, sent_at: null, total: null },
        { ...proposal, id: 'pending', status: 'viewed', responded_at: null, delivered_at: null },
      ],
    })
    expect(result.accepted).toBe(1)
    expect(result.manualAcceptances).toBe(1)
    expect(result.timing.acceptance).toMatchObject({ count: 0, missing: 1, meanHours: null })
    expect(result.waiting72h).toBe(1)
    expect(result.timing.pendingAge.meanHours).toBe(408)
    expect(result.acceptanceRate).toBe(0)
    expect(result.decidedAcceptanceRate).toBeNull()
    expect(result.acceptedValue).toBeNull()
  })

  it('separates acceptance over all sends from acceptance over decided sends', () => {
    const result = buildCommercialPerformance({
      ...input,
      proposals: [
        proposal,
        { ...proposal, id: 'rejected', status: 'rejected' },
        { ...proposal, id: 'pending', status: 'sent' },
      ],
    })
    expect(result.acceptanceRate).toBeCloseTo(100 / 3)
    expect(result.decidedAcceptanceRate).toBe(50)
  })

  it('counts each active lead once and ignores expired or malformed reminders', () => {
    const result = buildCommercialPerformance({
      ...input,
      leads: [lead, { ...lead, id: 'lead-2' }, { ...lead, id: 'lead-3', status: 'won' }],
      reminders: [
        { lead_id: lead.id, start_at: '2026-08-21' },
        { lead_id: lead.id, start_at: '2026-08-22' },
        { lead_id: 'lead-2', start_at: '2026-08-19' },
        { lead_id: 'lead-2', start_at: 'invalid' },
      ],
    })
    expect(result.active).toBe(2)
    expect(result.covered).toBe(1)
    expect(result.withoutNextStep).toBe(1)
    expect(result.coverageRate).toBe(50)
  })

  it('attributes leads to current owner and proposals to author without rewarding call volume', () => {
    const result = buildCommercialPerformance(input)
    expect(result.byMember[0]).toMatchObject({ id: 'sales-2', leads: 0, accepted: 1, sent: 1 })
    expect(result.byMember[1]).toMatchObject({ id: 'sales-1', leads: 1, accepted: 0, active: 1 })
  })

  it('uses status events, not updated_at, to time won leads', () => {
    const result = buildCommercialPerformance({
      ...input,
      leads: [{ ...lead, status: 'won' }],
      interactions: [
        {
          id: 'won-1',
          lead_id: lead.id,
          performed_by: 'sales-1',
          type: 'status_change',
          created_at: '2026-08-06T00:00:00Z',
          payload: { to: 'won' },
        },
      ],
    })
    expect(result.timing.leadToWin.meanHours).toBe(120)
  })

  it('averages tickets only over proposals with an available price', () => {
    const result = buildCommercialPerformance({
      ...input,
      proposals: [proposal, { ...proposal, id: 'unpriced', total: null }],
    })
    expect(result.pricedAccepted).toBe(1)
    expect(result.averageAcceptedValue).toBe(1000)
  })
})
