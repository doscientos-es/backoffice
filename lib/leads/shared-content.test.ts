import { describe, expect, it } from 'vitest'

import { publicLeadName, sanitizeLeadSharedText } from './shared-content'

describe('lead shared content', () => {
  it('prefers the company name and replaces aliases and contact names in shared text', () => {
    const lead = { alias: 'Nube', name: 'Ana García', company: 'Acme S.L.' }

    expect(publicLeadName(lead)).toBe('Acme S.L.')
    expect(sanitizeLeadSharedText('Reunión con Nube y Ana García.', lead)).toBe(
      'Reunión con Acme S.L. y Acme S.L.',
    )
    expect(sanitizeLeadSharedText('Hola, Ana.', lead)).toBe('Hola, Ana.')
  })

  it('falls back to the lead name and safely handles aliases with regex characters', () => {
    const lead = { alias: 'Nube+', name: 'Ana García', company: null }

    expect(publicLeadName(lead)).toBe('Ana García')
    expect(sanitizeLeadSharedText('Reunión con Nube+', lead)).toBe('Reunión con Ana García')
  })
})
