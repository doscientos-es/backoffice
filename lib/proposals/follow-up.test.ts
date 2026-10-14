import { describe, expect, it } from 'vitest'

import { proposalFollowUp } from './follow-up'

const now = new Date('2026-08-10T12:00:00Z')
const proposal = {
  status: 'sent',
  sent_at: '2026-08-06T12:00:00Z',
  viewed_at: null,
  valid_until: null,
}

describe('proposalFollowUp', () => {
  it('offers a concrete next step for an unopened proposal after 72 hours', () => {
    expect(proposalFollowUp(proposal, now)).toMatchObject({
      label: 'Confirmar recepción de la propuesta',
      overdue: true,
    })
    expect(proposalFollowUp(proposal, now)?.hint).toContain('sin apertura registrada')
  })
  it('prioritizes resolving questions for viewed proposals instead of confirming receipt', () => {
    expect(
      proposalFollowUp({ ...proposal, status: 'viewed', viewed_at: '2026-08-07T12:00:00Z' }, now)
        ?.label,
    ).toBe('Resolver dudas y acordar decisión')
  })
  it('asks to recheck conditions when the validity expired', () => {
    expect(proposalFollowUp({ ...proposal, valid_until: '2026-08-01' }, now)?.label).toBe(
      'Confirmar interés y revisar vigencia',
    )
  })
  it('does not treat drafts or decided proposals as waiting for response', () => {
    for (const status of ['draft', 'accepted', 'rejected'])
      expect(proposalFollowUp({ ...proposal, status }, now)).toBeNull()
  })
  it('does not invent an age when the sending date is absent or invalid', () => {
    expect(proposalFollowUp({ ...proposal, sent_at: null }, now)?.hint).toContain(
      'sin fecha registrada',
    )
    expect(proposalFollowUp({ ...proposal, sent_at: 'invalid' }, now)?.overdue).toBe(false)
  })
})
