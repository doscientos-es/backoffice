import { describe, expect, it } from 'vitest'
import {
  deliveryAcceptanceClause,
  deliveryAcceptanceDeadline,
  deliveryAcceptanceHash,
  deliveryAcceptanceSnapshot,
} from './delivery-acceptance'

describe('delivery acceptance', () => {
  it('never describes the deadline as an automatic signature', () => {
    const clause = deliveryAcceptanceClause({ enabled: true, days: 7, mode: 'explicit_or_uncontested' })
    expect(clause).toContain('conformidad no impugnada en plazo')
    expect(clause).toContain('sin crear ni atribuir al Cliente una firma')
    expect(clause.toLowerCase()).not.toContain('autofirma')
  })

  it('creates a deterministic evidence hash and bounded deadline', () => {
    const snapshot = deliveryAcceptanceSnapshot({ proposal: 'p1', total: 100 })
    expect(deliveryAcceptanceHash(snapshot)).toHaveLength(64)
    expect(deliveryAcceptanceDeadline(new Date('2026-01-01T00:00:00.000Z'), 7).toISOString())
      .toBe('2026-01-08T00:00:00.000Z')
  })
})
