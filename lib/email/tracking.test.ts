import { describe, expect, it } from 'vitest'

import { addEmailTracking } from './tracking'

describe('seguimiento de enlaces', () => {
  it('conserva los parámetros de URLs codificadas en HTML', () => {
    const html = addEmailTracking(
      '<a href="https://example.test/?a=1&amp;b=2">Abrir</a>',
      'https://example.test',
      'token-1',
    )
    const href = html.match(/href="([^"]+)"/)?.[1]
    expect(href).toBeTruthy()
    expect(new URL(href!).searchParams.get('url')).toBe('https://example.test/?a=1&b=2')
  })
})
