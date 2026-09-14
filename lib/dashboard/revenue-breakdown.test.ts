import { describe, expect, it } from 'vitest'

import { buildRevenueBreakdown } from '@/lib/dashboard/queries'

describe('buildRevenueBreakdown', () => {
  const now = new Date('2026-06-15T12:00:00Z')

  it('groups monthly revenue by project and keeps unlinked invoices visible', () => {
    const breakdown = buildRevenueBreakdown(
      [
        {
          issue_date: '2026-05-10', total: 100, projects: { id: 'web', name: 'Web' }, clients: null,
        },
        {
          issue_date: '2026-05-12', total: 50, projects: null, clients: null,
        },
        {
          issue_date: '2026-06-02', total: 200, projects: { id: 'web', name: 'Web' }, clients: null,
        },
      ],
      2,
      now,
      'project',
    )

    expect(breakdown.series.map((series) => series.label)).toEqual(['Web', 'Sin proyecto'])
    expect(breakdown.points).toEqual([
      { month: 'may', total: 150, 'series_project:web': 100, 'series_project:unattributed': 50 },
      { month: 'jun', total: 200, 'series_project:web': 200, 'series_project:unattributed': 0 },
    ])
  })

  it('aggregates groups outside the six largest entities into Otros', () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      issue_date: '2026-06-01',
      total: index + 1,
      projects: { id: `${index}`, name: `Proyecto ${index}` },
      clients: null,
    }))

    const breakdown = buildRevenueBreakdown(rows, 1, now, 'project')

    expect(breakdown.series).toHaveLength(7)
    expect(breakdown.series.at(-1)?.label).toBe('Otros')
    expect(breakdown.points[0]?.total).toBe(28)
    expect(breakdown.points[0]?.others).toBe(1)
  })
})