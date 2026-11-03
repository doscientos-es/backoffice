import { describe, expect, it } from 'vitest'

import { CreateProposalInput, UpdateProposalInput } from './proposal'

const id = '494d62cb-fd56-4650-b131-9e3a927a20ad'
const create = {
  lead_id: id,
  title: 'Propuesta',
  items: [{ description: 'Servicio', quantity: 1, unit_price: 100 }],
}
const update = { id, expected_version: 1 }

describe('proposal demo URL', () => {
  it.each([create, update])('accepts and trims a web URL and clears an empty value', (input) => {
    const schema = 'lead_id' in input ? CreateProposalInput : UpdateProposalInput
    expect(schema.parse({ ...input, demo_url: '  https://example.test/demo  ' }).demo_url).toBe(
      'https://example.test/demo',
    )
    expect(schema.parse({ ...input, demo_url: '   ' }).demo_url).toBeNull()
    expect(schema.parse(input).demo_url).toBeUndefined()
  })

  it.each([
    'javascript:alert(1)',
    'https://user:pass@example.test',
    'not a url',
    'ftp://example.test',
  ])('rejects unsafe or invalid URLs: %s', (demo_url) => {
    expect(CreateProposalInput.safeParse({ ...create, demo_url }).success).toBe(false)
    expect(UpdateProposalInput.safeParse({ ...update, demo_url }).success).toBe(false)
  })
})
