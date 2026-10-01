// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

describe('logger', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('initializes even with missing app credentials and an invalid log level', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    vi.stubEnv('LOG_LEVEL', 'invalid')
    const { scopedLogger } = await import('./logger')
    expect(scopedLogger('test').level).toBe('info')
  })
})
