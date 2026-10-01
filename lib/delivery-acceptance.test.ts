import { describe, expect, it } from 'vitest'

import {
  deliveryAcceptanceClause,
  deliveryAcceptanceDeadline,
  deliveryAcceptanceHash,
  deliveryAcceptanceSnapshot,
  deliveryNoteSnapshot,
  deliveryNoteStatement,
} from './delivery-acceptance'

const noteInput = {
  proposalNumber: 'P-2026-001',
  proposalTitle: 'Web corporativa',
  proposalAcceptedAt: '2026-09-01T00:00:00.000Z',
  clientName: 'Acme SL',
  projectName: 'Web Acme',
  scopeModules: [{ title: 'Diseño', included: ['Home'] }],
  deliverables: null,
  acceptanceCriteria: null,
  maintenancePlanName: null,
}

describe('delivery acceptance', () => {
  it('never describes the deadline as an automatic signature', () => {
    const clause = deliveryAcceptanceClause({
      enabled: true,
      days: 7,
      mode: 'explicit_or_uncontested',
    })
    expect(clause).toContain('conformidad no impugnada en plazo')
    expect(clause).toContain('sin crear ni atribuir al Cliente una firma')
    expect(clause.toLowerCase()).not.toContain('autofirma')
  })

  it('creates a deterministic evidence hash and bounded deadline', () => {
    const snapshot = deliveryAcceptanceSnapshot({ proposal: 'p1', total: 100 })
    expect(deliveryAcceptanceHash(snapshot)).toHaveLength(64)
    expect(deliveryAcceptanceDeadline(new Date('2026-01-01T00:00:00.000Z'), 7).toISOString()).toBe(
      '2026-01-08T00:00:00.000Z',
    )
  })

  it('mentions maintenance in the delivery note only when a plan is selected', () => {
    expect(deliveryNoteStatement(noteInput)).toContain('P-2026-001')
    expect(deliveryNoteStatement(noteInput)).not.toContain('mantenimiento')
    expect(deliveryNoteStatement({ ...noteInput, maintenancePlanName: 'Básico' })).toContain(
      'mantenimiento «Básico»',
    )
  })

  it('snapshots the delivery note with a stable hash', () => {
    const snapshot = deliveryNoteSnapshot(noteInput)
    expect(snapshot.kind).toBe('delivery_note')
    expect(snapshot.statement).toBe(deliveryNoteStatement(noteInput))
    expect(deliveryAcceptanceHash(snapshot)).toBe(
      deliveryAcceptanceHash(deliveryNoteSnapshot(noteInput)),
    )
  })
})
