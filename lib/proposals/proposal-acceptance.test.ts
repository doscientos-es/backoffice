import { describe, expect, it } from 'vitest'

import { effectiveProposalTerms } from './proposal-acceptance'

describe('proposal acceptance terms', () => {
  it('sets commercially protective, legally bounded payment and delivery terms', () => {
    const terms = effectiveProposalTerms(null)

    expect(terms).toContain('Ley 3/2004')
    expect(terms).toContain('10 días hábiles')
    expect(terms).toContain('no libera al Cliente del pago de los importes devengados')
    expect(terms).toContain('Los derechos imperativos de consumidores y usuarios')
  })

  it('keeps particular terms before the standard terms', () => {
    expect(effectiveProposalTerms('Condición particular')).toMatch(
      /^Condición particular\n\n1\. \*\*Contrato y alcance\.\*\*/,
    )
  })
})