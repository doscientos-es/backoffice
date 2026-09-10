import { describe, expect, it } from 'vitest'

import { effectiveProposalTerms } from './proposal-acceptance'

describe('proposal acceptance terms', () => {
  it('sets commercially protective, legally bounded payment and delivery terms', () => {
    const terms = effectiveProposalTerms(null)

    expect(terms).toContain('Ley 3/2004')
    expect(terms).toContain('10 días hábiles')
    expect(terms).toContain('no libera al Cliente del pago de los importes devengados')
    expect(terms).toContain('Los derechos imperativos de consumidores y usuarios')
    expect(terms).toContain('Caso de éxito')
    expect(terms).toContain('Vigencia, prelación y modificaciones')
    expect(terms).toContain('evidencia de aceptación')
    expect(terms).toContain('Fuerza mayor')
    expect(terms).toContain('Comunicaciones, cesión y separabilidad')
  })

  it('keeps particular terms before the standard terms', () => {
    expect(effectiveProposalTerms('Condición particular')).toMatch(
      /^Condición particular\n\n1\. \*\*Contrato, partes y alcance\.\*\*/,
    )
  })

  it('uses the proposal-specific annex when one is configured', () => {
    expect(effectiveProposalTerms('Condición particular', 'Anexo personalizado')).toBe(
      'Condición particular\n\nAnexo personalizado',
    )
  })
})