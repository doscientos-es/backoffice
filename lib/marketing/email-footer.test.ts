import { describe, expect, it } from 'vitest'

import { renderMarketingFooter } from './email-footer'

describe('pie de email marketing', () => {
  it('escapa las direcciones e incluye los enlaces de baja y privacidad', () => {
    const html = renderMarketingFooter(
      'https://example.test/unsubscribe?a=1&b=2',
      'https://example.test/privacy',
    )
    expect(html).toContain('href="https://example.test/unsubscribe?a=1&amp;b=2"')
    expect(html).toContain('>Dejar de recibir correos</a>')
    expect(html).toContain('href="https://example.test/privacy"')
  })
})
