import { describe, expect, it } from 'vitest'

import { getPathValue, initialValues } from './fields'
import type { DocumentGenerationContext, DocumentTemplateField } from './types'

const context: DocumentGenerationContext = {
  lead: { name: 'Marta Soler', company: 'Fincas Soler', email: 'marta@example.com' },
  client: null,
  project: null,
  company: {
    company_name: 'Doscientos SL',
    company_nif: 'B12345678',
    company_address: 'Calle Mayor 1',
  },
}

describe('document template field sources', () => {
  it('uses lead data when a client has not been created yet', () => {
    expect(getPathValue('client.name', context)).toBe('Fincas Soler')
    expect(getPathValue('client.contact_person', context)).toBe('Marta Soler')
    expect(getPathValue('lead.email', context)).toBe('marta@example.com')
  })

  it('prefills company and lead fields for a generic document', () => {
    const fields: DocumentTemplateField[] = [
      {
        name: 'our_company_name',
        label: 'Our company name',
        kind: 'text',
        required: true,
        role: 'internal',
        source: 'company.company_name',
      },
      {
        name: 'lead_company',
        label: 'Lead company',
        kind: 'text',
        required: true,
        role: 'internal',
        source: 'lead.company',
      },
    ]

    expect(initialValues(fields, context)).toEqual({
      our_company_name: 'Doscientos SL',
      lead_company: 'Fincas Soler',
    })
  })
})