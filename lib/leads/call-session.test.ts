import { describe, expect, it } from 'vitest'

import { completeCallSession } from './call-session'

describe('completeCallSession', () => {
  it('marks attempts below thirty seconds as unanswered', () => {
    expect(completeCallSession('2026-09-10T10:00:00.000Z', null, '2026-09-10T10:00:29.000Z')).toEqual({
      durationSeconds: 29,
      durationMinutes: 0,
      defaultOutcome: 'no_answer',
    })
  })

  it('uses the dial time and rounds a real conversation to whole minutes', () => {
    expect(
      completeCallSession('2026-09-10T10:00:00.000Z', '2026-09-10T10:00:10.000Z', '2026-09-10T10:02:40.000Z'),
    ).toEqual({ durationSeconds: 150, durationMinutes: 3, defaultOutcome: 'connected' })
  })
})