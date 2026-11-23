import { describe, expect, it } from 'vitest'

import { publicPaymentScheduleLabel, publicScopeDuration } from './public-copy'
import type { ScopeModule } from './scope'

const module: ScopeModule = { id: 'scope', title: 'Scope', included: [], excluded: [] }

describe('public proposal copy', () => {
  it.each([
    ['1 día', '1 dia', '1 day'],
    ['2 días', '2 dies', '2 days'],
    ['1 semana', '1 setmana', '1 week'],
    ['2 semanas', '2 setmanes', '2 weeks'],
    ['1 mes', '1 mes', '1 month'],
    ['2 meses', '2 mesos', '2 months'],
  ])('localizes the custom duration %s', (duration, ca, en) => {
    const scope = { ...module, duration_mode: 'custom' as const, duration_custom: duration }
    expect(publicScopeDuration(scope, 'es')).toBe(duration)
    expect(publicScopeDuration(scope, 'ca')).toBe(ca)
    expect(publicScopeDuration(scope, 'en')).toBe(en)
  })

  it('preserves unrecognized legacy duration text', () => {
    expect(
      publicScopeDuration(
        { ...module, duration_mode: 'custom', duration_custom: 'Custom text' },
        'en',
      ),
    ).toBe('Custom text')
  })

  it('localizes the payment schedule without changing its value', () => {
    expect(publicPaymentScheduleLabel('upfront', 'ca')).toBe('100 % en acceptar')
    expect(publicPaymentScheduleLabel('upfront', 'en')).toBe('100 % on acceptance')
  })
})
