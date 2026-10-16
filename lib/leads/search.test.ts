import { describe, expect, it } from 'vitest'

import { buildLeadSearchFilters, normalizeLeadSearchText } from './search'

describe('lead search', () => {
  it('normalizes case, accents, ñ and decomposed Unicode consistently', () => {
    expect(normalizeLeadSearchText('María GARCÍA · Àlex Muñoz · Jose\u0301')).toBe(
      'maria garcia · alex munoz · jose',
    )
  })

  it.each(['', '   ', '\t\n', '\u00a0'])('does not filter an empty query: %j', (query) => {
    expect(buildLeadSearchFilters(query)).toEqual([])
  })

  it('uses all distinct words, allowing any order and different contact fields', () => {
    expect(buildLeadSearchFilters('  GARCÍA\tAcme\nMARÍA garcía ')).toEqual([
      'search_text.ilike."%garcia%"',
      'search_text.ilike."%acme%"',
      'search_text.ilike."%maria%"',
    ])
  })

  it.each([
    '671171525',
    '671 171 525',
    '671\u00a0171\u00a0525',
    '671-171-525',
    '(671) 171.525',
    '671 / 171 / 525',
    '671–171—525',
    '+34 671 171 525',
    '34671171525',
    '0034 671 171 525',
  ])('searches a complete formatted phone as a contiguous number: %s', (query) => {
    const filters = buildLeadSearchFilters(query)
    expect(filters).toHaveLength(1)
    expect(filters[0]).toContain('search_phone.ilike."%671171525%"')
  })

  it.each(['525', '171525', '34', '0034', '+44 20 7946 0958'])(
    'preserves partial numbers and non-Spanish country codes: %s',
    (query) => {
      expect(buildLeadSearchFilters(query)[0]).toContain(
        `search_phone.ilike."%${query.replace(/\D/g, '')}%"`,
      )
    },
  )

  it('supports a name combined with a phone fragment', () => {
    expect(buildLeadSearchFilters('María 171525')).toEqual([
      'search_text.ilike."%maria%"',
      'search_text.ilike."%171525%",search_phone.ilike."%171525%"',
    ])
  })

  it.each(['ANA@EMPRESA.ES', '@empresa.es', 'ana+ventas@empresa.es'])(
    'finds whole emails, domains and email fragments literally: %s',
    (query) => {
      expect(buildLeadSearchFilters(query)).toEqual([
        `search_text.ilike."%${query.toLowerCase()}%"`,
      ])
    },
  )

  it('quotes PostgREST punctuation instead of treating it as filter syntax', () => {
    expect(buildLeadSearchFilters('Acme,Inc.')).toEqual(['search_text.ilike."%acme,inc.%"'])
    expect(buildLeadSearchFilters('(Acme)')).toEqual(['search_text.ilike."%(acme)%"'])
    expect(buildLeadSearchFilters('"Acme"')).toEqual(['search_text.ilike."%\\"acme\\"%"'])
  })

  it('escapes SQL wildcards and backslashes as well as PostgREST literals', () => {
    expect(buildLeadSearchFilters('50%')).toEqual(['search_text.ilike."%50\\\\%%"'])
    expect(buildLeadSearchFilters('ana_ventas')).toEqual(['search_text.ilike."%ana\\\\_ventas%"'])
    expect(buildLeadSearchFilters('acme\\crm')).toEqual(['search_text.ilike."%acme\\\\\\\\crm%"'])
  })

  it('does not treat digits inside a name or email as a phone', () => {
    expect(buildLeadSearchFilters('estudio34 ana671@example.com')).toEqual([
      'search_text.ilike."%estudio34%"',
      'search_text.ilike."%ana671@example.com%"',
    ])
  })
})
