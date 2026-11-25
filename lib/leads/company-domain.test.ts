import { describe, expect, it } from 'vitest'

import { corporateDomainFromEmail, isCorporateDomain } from './company-domain'

describe('corporate email domains', () => {
  it('normalizes valid corporate emails', () => {
    expect(corporateDomainFromEmail(' Ana+sales@EXAMPLE.TEST. ')).toBe('example.test')
  })

  it.each(['gmail.com', 'outlook.es', 'telefonica.net', 'gmil.com', 'tenant.onmicrosoft.com'])(
    'excludes personal and hosted provider %s',
    (domain) => expect(corporateDomainFromEmail(`ana@${domain}`)).toBeNull(),
  )

  it.each([
    'a@@example.test',
    'a b@example.test',
    'a@example.test/path',
    'a@localhost',
    'a@127.0.0.1',
  ])('rejects malformed email %s', (email) => expect(corporateDomainFromEmail(email)).toBeNull())

  it('accepts a company name only when it is already a valid domain', () => {
    expect(isCorporateDomain('example.test')).toBe(true)
    expect(isCorporateDomain('Example Company')).toBe(false)
    expect(isCorporateDomain('example.test?x=1')).toBe(false)
  })
})
