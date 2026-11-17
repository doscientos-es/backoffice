import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { describe, expect, it } from 'vitest'

import config from './next.config'

describe('Next.js deployment configuration', () => {
  it('traces the native XML binding required by VERI*FACTU XSD validation', () => {
    expect(config.outputFileTracingIncludes?.['/*']).toContain('./node_modules/libxmljs2/**/*')
  })

  it.each([
    '/',
    '/p/proposal/example',
    '/p/proposal/example/pdf',
    '/p/invoice/example',
    '/p/invoice/example/pdf',
    '/p/project/example',
    '/p/nda/example',
    '/p/delivery/example',
    '/deck/example',
    '/portal/example',
    '/api/public/example',
  ])('sends an anti-indexing header for %s', async (path) => {
    const rules = await config.headers?.()
    const headers = rules
      ?.filter((rule) => getPathMatch(rule.source)(path) !== false)
      .flatMap((rule) => rule.headers)
    expect(headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' })
  })
})
