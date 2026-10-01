import { describe, expect, it } from 'vitest'

import { type QuarterlyPeriod, quarterlyPeriod } from '@/lib/exports/quarterly-invoices'
import {
  filingDeadline,
  madridToday,
  QUARTERLY_REMINDER_DAYS,
  quarterlyHandoff,
  recentClosedQuarters,
} from '@/lib/finance/quarterly-handoff'

const sentQuarters =
  (...labels: string[]) =>
  (period: { label: string }) =>
    labels.includes(period.label)
const nothingSent = sentQuarters()

function period(year: string, quarter: string): QuarterlyPeriod {
  const result = quarterlyPeriod(year, quarter)
  if (!result) throw new Error(`Invalid quarter ${year}-${quarter}`)
  return result
}

describe('madridToday', () => {
  it('uses the Spanish date in summer time (UTC+2)', () => {
    expect(madridToday(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10-01')
    expect(madridToday(new Date('2026-09-30T21:59:00Z'))).toBe('2026-09-30')
  })

  it('uses the Spanish date in winter time (UTC+1) across the new year', () => {
    expect(madridToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    expect(madridToday(new Date('2026-12-31T22:59:00Z'))).toBe('2026-12-31')
  })
})

describe('filingDeadline', () => {
  it('is the 20th of the month after the quarter', () => {
    expect(filingDeadline(period('2026', '1'))).toBe('2026-04-20')
    expect(filingDeadline(period('2026', '2'))).toBe('2026-07-20')
    expect(filingDeadline(period('2026', '3'))).toBe('2026-10-20')
  })

  it('is 30 January of the next year for T4', () => {
    expect(filingDeadline(period('2026', '4'))).toBe('2027-01-30')
  })
})

describe('recentClosedQuarters', () => {
  it('lists closed quarters newest first, crossing years', () => {
    expect(recentClosedQuarters('2027-02-10').map((p) => p.label)).toEqual([
      'T4 2026',
      'T3 2026',
      'T2 2026',
      'T1 2026',
    ])
  })

  it('never includes the open quarter, even on its last day', () => {
    expect(recentClosedQuarters('2026-12-31', 1)[0]?.label).toBe('T3 2026')
    expect(recentClosedQuarters('2027-01-01', 1)[0]?.label).toBe('T4 2026')
  })
})

describe('quarterlyHandoff', () => {
  it('stays quiet before the reminder window', () => {
    const handoff = quarterlyHandoff('2026-09-23', sentQuarters('T2 2026'))
    expect(handoff.status).toBe('idle')
    expect(handoff.period.label).toBe('T2 2026')
  })

  it(`warns ${QUARTERLY_REMINDER_DAYS} days before the hand-off day`, () => {
    const handoff = quarterlyHandoff('2026-09-24', sentQuarters('T2 2026'))
    expect(handoff).toMatchObject({
      status: 'upcoming',
      handoffDate: '2026-10-01',
      daysUntilHandoff: 7,
    })
    expect(handoff.period.label).toBe('T3 2026')
  })

  it('keeps warning until the last day of the quarter', () => {
    const handoff = quarterlyHandoff('2026-09-30', sentQuarters('T2 2026'))
    expect(handoff.status).toBe('upcoming')
    expect(handoff.daysUntilHandoff).toBe(1)
  })

  it('marks the closed quarter as due on the hand-off day', () => {
    const handoff = quarterlyHandoff('2026-10-01', nothingSent)
    expect(handoff).toMatchObject({
      status: 'due',
      handoffDate: '2026-10-01',
      filingDeadline: '2026-10-20',
      daysUntilHandoff: 0,
    })
    expect(handoff.period.label).toBe('T3 2026')
  })

  it('stays due until the filing deadline and then becomes overdue', () => {
    expect(quarterlyHandoff('2026-10-20', nothingSent).status).toBe('due')
    const late = quarterlyHandoff('2026-10-21', nothingSent)
    expect(late.status).toBe('overdue')
    expect(late.period.label).toBe('T3 2026')
  })

  it('shows the quarter as sent until the filing deadline, then goes idle', () => {
    const sent = sentQuarters('T3 2026')
    expect(quarterlyHandoff('2026-10-05', sent).status).toBe('sent')
    expect(quarterlyHandoff('2026-11-15', sent).status).toBe('idle')
  })

  it('handles T4 across the year change', () => {
    const sent = sentQuarters('T3 2026')
    const upcoming = quarterlyHandoff('2026-12-25', sent)
    expect(upcoming.status).toBe('upcoming')
    expect(upcoming.period.label).toBe('T4 2026')
    expect(upcoming.handoffDate).toBe('2027-01-01')

    const due = quarterlyHandoff('2027-01-01', sent)
    expect(due.status).toBe('due')
    expect(due.period.label).toBe('T4 2026')
    expect(due.filingDeadline).toBe('2027-01-30')

    expect(quarterlyHandoff('2027-01-30', sent).status).toBe('due')
    expect(quarterlyHandoff('2027-01-31', sent).status).toBe('overdue')
  })

  it('counts days correctly in a leap-year first quarter', () => {
    const handoff = quarterlyHandoff('2028-02-29', sentQuarters('T4 2027'))
    expect(handoff.status).toBe('idle')
    const upcoming = quarterlyHandoff('2028-03-25', sentQuarters('T4 2027'))
    expect(upcoming.status).toBe('upcoming')
    expect(upcoming.daysUntilHandoff).toBe(7)
    expect(upcoming.handoffDate).toBe('2028-04-01')
  })
})
