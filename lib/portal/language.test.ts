import { describe, expect, it } from 'vitest'

import { formatPortalDate, formatPortalEUR, type PortalLanguage } from './language'

describe('portal formatting', () => {
  it.each<PortalLanguage>(['es', 'ca', 'en'])(
    'preserves currency and date output in %s',
    (language) => {
      const locale = `${language}-${language === 'en' ? 'GB' : 'ES'}`
      const currency = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' })
      const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' })
      for (const value of [0, 1234.5, -10]) {
        expect(formatPortalEUR(value, language)).toBe(currency.format(value))
      }
      expect(formatPortalDate('2026-10-01', language)).toBe(date.format(new Date('2026-10-01')))
      expect(formatPortalDate('2026-10-02', language)).toBe(date.format(new Date('2026-10-02')))
    },
  )

  it('keeps missing and invalid dates empty', () => {
    expect(formatPortalDate(null, 'es')).toBe('—')
    expect(formatPortalDate('invalid', 'en')).toBe('—')
  })
})
