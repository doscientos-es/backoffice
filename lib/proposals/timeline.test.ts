import { describe, expect, it } from 'vitest'

import { proposalAcceptanceHash, proposalAcceptanceSnapshot } from './proposal-acceptance'
import {
  formatTimelineDate,
  nextTimelineWeek,
  parseTimeline,
  timelineCalendar,
  timelineInput,
  timelineLayout,
} from './timeline'

const first = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'Diseño, revisión',
  description: 'Uno; dos\nTres\\cuatro',
  start_date: '2028-02-28',
  end_date: '2028-02-29',
}
const second = {
  id: '10000000-0000-4000-8000-000000000002',
  title: 'Entrega',
  description: '',
  start_date: '2028-03-02',
  end_date: '2028-03-02',
}

describe('proposal timeline', () => {
  it('validates real dates, required titles and inclusive date order', () => {
    expect(timelineInput.safeParse([first]).success).toBe(true)
    expect(timelineInput.safeParse([{ ...first, start_date: '2027-02-29' }]).success).toBe(false)
    expect(timelineInput.safeParse([{ ...first, title: ' ' }]).success).toBe(false)
    expect(timelineInput.safeParse([{ ...first, end_date: '2028-02-27' }]).success).toBe(false)
    expect(parseTimeline(null)).toEqual([])
    expect(nextTimelineWeek('2028-02-28')).toEqual({
      start_date: '2028-02-29',
      end_date: '2028-03-06',
    })
    expect(nextTimelineWeek('')).toBeNull()
  })

  it('orders overlapping and separate milestones on the same inclusive scale', () => {
    const rows = timelineLayout([second, first])
    expect(rows.map(({ item }) => item.title)).toEqual([first.title, second.title])
    expect(rows[0]).toMatchObject({ left: 0, width: 50 })
    expect(rows[1]).toMatchObject({ left: 75, width: 25 })
    expect(formatTimelineDate('2028-02-29', 'en')).toContain('29 February 2028')
  })

  it('exports every item as an escaped, folded all-day calendar event', () => {
    const ics = timelineCalendar([second, first], 'proposal-1', 'Proyecto')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('DTSTART;VALUE=DATE:20280228\r\nDTEND;VALUE=DATE:20280301')
    expect(ics).toContain('DTSTART;VALUE=DATE:20280302\r\nDTEND;VALUE=DATE:20280303')
    expect(ics).toContain('SUMMARY:Proyecto: Diseño\\, revisión')
    expect(ics).toContain('DESCRIPTION:Uno\\; dos\\nTres\\\\cuatro')
    const long = timelineCalendar([{ ...first, title: 'á'.repeat(100) }], 'proposal-1', 'Proyecto')
    for (const line of long.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })

  it('records timelines in signature evidence without changing legacy hashes', () => {
    const base = proposalAcceptanceSnapshot({ id: 'p' }, [], null)
    const empty = proposalAcceptanceSnapshot({ id: 'p', timeline: [] }, [], null)
    const signed = proposalAcceptanceSnapshot({ id: 'p', timeline: [first] }, [], null)
    expect(proposalAcceptanceHash(empty)).toBe(proposalAcceptanceHash(base))
    expect(signed.proposal).toHaveProperty('timeline', [first])
    expect(proposalAcceptanceHash(signed)).not.toBe(proposalAcceptanceHash(base))
  })
})
