import { describe, expect, it } from 'vitest'

import { anonymizationPatch } from './service'

describe('privacy anonymization', () => {
  it('removes direct identifiers and disables marketing for leads', () => {
    expect(anonymizationPatch('lead')).toMatchObject({
      name: 'Contacto anonimizado',
      email: null,
      phone: null,
      raw_payload: null,
      marketing_consent: false,
      privacy_anonymized_at: expect.any(String),
    })
  })

  it('does not allow team-member anonymization without legal review', () => {
    expect(anonymizationPatch('team_member')).toBeNull()
  })
})