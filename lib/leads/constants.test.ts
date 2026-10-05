import { describe, expect, it } from 'vitest'

import { normalizeLeadSource } from './constants'

describe('normalizeLeadSource', () => {
  it('canonicalizes paid-social source aliases regardless of case', () => {
    expect(normalizeLeadSource('facebook')).toBe('Anuncios Meta')
    expect(normalizeLeadSource(' Facebook ')).toBe('Anuncios Meta')
    expect(normalizeLeadSource('INSTAGRAM')).toBe('Anuncios Meta')
    expect(normalizeLeadSource('paid_social')).toBe('Anuncios Meta')
  })

  it('preserves non-Meta source values', () => {
    expect(normalizeLeadSource('Landing')).toBe('Landing')
  })
})
