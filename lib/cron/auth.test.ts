import { describe, expect, it } from 'vitest'

import { isAuthorizedCronRequest } from './auth'

function request(authorization?: string) {
  return new Request('https://backoffice.test/api/cron/example', {
    headers: authorization ? { Authorization: authorization } : {},
  })
}

describe('isAuthorizedCronRequest', () => {
  it('fails closed when no secret is configured', () => {
    expect(isAuthorizedCronRequest(request('Bearer arbitrary'), ['', undefined])).toBe(false)
  })

  it('accepts only an exact configured Bearer or bare token', () => {
    expect(isAuthorizedCronRequest(request('Bearer cron-secret'), ['cron-secret'])).toBe(true)
    expect(isAuthorizedCronRequest(request('cron-secret'), ['cron-secret'])).toBe(true)
    expect(isAuthorizedCronRequest(request('Bearer cron-secret-extra'), ['cron-secret'])).toBe(false)
  })

  it('accepts either explicitly configured internal secret', () => {
    expect(isAuthorizedCronRequest(request('Bearer runner-secret'), ['cron-secret', 'runner-secret'])).toBe(
      true,
    )
  })
})