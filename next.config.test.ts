import { describe, expect, it } from 'vitest'

import config from './next.config'

describe('Next.js deployment configuration', () => {
  it('traces the native XML binding required by VERI*FACTU XSD validation', () => {
    expect(config.outputFileTracingIncludes?.['/*']).toContain('./node_modules/libxmljs2/**/*')
  })
})
