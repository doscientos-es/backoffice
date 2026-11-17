import { describe, expect, it } from 'vitest'

import {
  effectiveProposalTerms,
  proposalAcceptanceHash,
  proposalAcceptanceSnapshot,
} from './proposal-acceptance'

describe('proposal acceptance terms', () => {
  it('sets commercially protective, legally bounded payment and delivery terms', () => {
    const terms = effectiveProposalTerms(null)

    expect(terms).toContain('Ley 3/2004')
    expect(terms).toContain('10 días hábiles')
    expect(terms).toContain('no libera al Cliente del pago de los importes devengados')
    expect(terms).toContain('Los derechos imperativos de consumidores y usuarios')
    expect(terms).toContain('Casos de éxito y demostraciones')
    expect(terms).toContain('Vigencia, prelación y modificaciones')
    expect(terms).toContain('evidencia de aceptación')
    expect(terms).toContain('Fuerza mayor')
    expect(terms).toContain('Comunicaciones, cesión y separabilidad')
    expect(terms).toContain('Servicios recurrentes, facturación anual y actualización')
    expect(terms).toContain('variación interanual positiva del IPC general')
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

  it('includes the development approach in the signed document and its hash', () => {
    const base = { id: 'proposal-1' }
    const snapshot = proposalAcceptanceSnapshot(
      { ...base, development_approach: 'Revisión semanal.' },
      [],
      null,
    )
    expect(snapshot.proposal).toHaveProperty('development_approach', 'Revisión semanal.')
    expect(proposalAcceptanceHash(snapshot)).not.toBe(
      proposalAcceptanceHash(proposalAcceptanceSnapshot(base, [], null)),
    )
  })

  it.each([undefined, null, '', ' \n '])(
    'preserves legacy hashes when the optional development approach is empty: %s',
    (development_approach) => {
      const snapshot = proposalAcceptanceSnapshot(
        { id: 'proposal-1', development_approach },
        [],
        null,
      )
      expect(snapshot.proposal).not.toHaveProperty('development_approach')
      expect(proposalAcceptanceHash(snapshot)).toBe(
        proposalAcceptanceHash(proposalAcceptanceSnapshot({ id: 'proposal-1' }, [], null)),
      )
    },
  )
})
