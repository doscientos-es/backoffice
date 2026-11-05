import { describe, expect, it } from 'vitest'

import { personalizeMarketingText } from './personalization'

describe('personalización de marketing', () => {
  it('sustituye campos conocidos en una sola pasada y deja visibles los desconocidos', () => {
    expect(
      personalizeMarketingText('Hola {{nombre}} · {{empresa}} · {{ email }} · {{otro}}', {
        name: '{{email}}',
        company: null,
        email: 'ana@example.test',
      }),
    ).toBe('Hola {{email}} ·  · ana@example.test · {{otro}}')
  })
})
