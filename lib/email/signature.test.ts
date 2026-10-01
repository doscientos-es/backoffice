import { describe, expect, it } from 'vitest'

import { buildSignatureHtml } from './signature'

describe('Email signature', () => {
  it('includes the website link only once', () => {
    const html = buildSignatureHtml({ name: 'Pol Gubau' })

    expect(html.match(/<a href="https:\/\/doscientos\.es"/g)).toHaveLength(1)
    expect(html).not.toContain('>https://doscientos.es</a>')
  })
})
