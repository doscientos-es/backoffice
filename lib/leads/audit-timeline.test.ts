import { describe, expect, it } from 'vitest'

import { describeAuditEvent } from './audit-timeline'

describe('lead audit timeline presentation', () => {
  it('labels changed attribution and qualification fields without exposing values', () => {
    expect(
      describeAuditEvent({
        id: 'event-1',
        entityType: 'leads',
        occurredAt: '2026-10-09T10:00:00.000Z',
        actorId: 'member-1',
        actorName: 'Aina',
        action: 'update',
        changedFields: ['utm_campaign', 'estimated_value'],
        origin: 'backoffice',
      }),
    ).toEqual({
      title: 'Ficha actualizada',
      detail: 'campaña UTM · valor estimado',
      actor: 'Aina',
    })
  })

  it('marks AI-generated field changes and identifies automated actors', () => {
    expect(
      describeAuditEvent({
        id: 'event-2',
        entityType: 'leads',
        occurredAt: '2026-10-09T10:00:00.000Z',
        actorId: null,
        actorName: null,
        action: 'update',
        changedFields: ['ai_summary', 'ai_suggested_next_step'],
        origin: 'system',
      }),
    ).toEqual({
      title: 'Información asistida por IA actualizada',
      detail: 'resumen IA · siguiente paso IA',
      actor: 'Automatización',
    })
  })
})
