import { describe, expect, it } from 'vitest'

import { extractNextSteps, leadDidNotShow, meetingChips, parseMeetingInfo } from './meeting-info'

const imported = (extra: Record<string, unknown> = {}, attendees = ['lead@acme.com']) => ({
  meet_url: 'https://meet.google.com/abc',
  start: '2026-11-01T10:00:00Z',
  attendees,
  meet_artifacts: {
    processed_at: '2026-11-01T11:00:00Z',
    duration_minutes: 42,
    participants: [{ name: 'Pol', email: 'pol@doscientos.es' }],
    ...extra,
  },
})

describe('leadDidNotShow', () => {
  it('is true when the lead was invited and only team members joined', () => {
    expect(leadDidNotShow(parseMeetingInfo(imported()), 'lead@acme.com')).toBe(true)
  })

  it('is false when the lead joined, ignoring email case', () => {
    const info = parseMeetingInfo(
      imported({ participants: [{ name: 'Ana', email: 'Lead@Acme.com' }] }),
    )
    expect(leadDidNotShow(info, 'lead@acme.com')).toBe(false)
  })

  it('is false when an anonymous guest joined, because it could be the lead', () => {
    const info = parseMeetingInfo(imported({ participants: [{ name: 'Invitado', email: null }] }))
    expect(leadDidNotShow(info, 'lead@acme.com')).toBe(false)
  })

  it('is false when the lead was never invited or the meeting is not imported yet', () => {
    expect(leadDidNotShow(parseMeetingInfo(imported({}, [])), 'lead@acme.com')).toBe(false)
    expect(
      leadDidNotShow(parseMeetingInfo({ attendees: ['lead@acme.com'] }), 'lead@acme.com'),
    ).toBe(false)
  })
})

describe('meetingChips', () => {
  const now = new Date('2026-11-02T00:00:00Z')

  it('shows a waiting chip for a finished meeting without artifacts', () => {
    const chips = meetingChips(parseMeetingInfo({ start: '2026-11-01T10:00:00Z' }), {
      leadEmail: null,
      now,
    })
    expect(chips).toEqual([{ text: 'Esperando notas de Meet', tone: 'warning' }])
  })

  it('summarises an imported meeting', () => {
    const info = parseMeetingInfo(imported({ summary: 'Resumen' }))
    const texts = meetingChips(info, { leadEmail: 'otro@x.com', now }).map((c) => c.text)
    expect(texts).toEqual(['42 min', '1 participante', 'Resumen listo'])
  })
})

describe('extractNextSteps', () => {
  it('reads the bullets under the heading and stops at the next section', () => {
    const text = [
      'Resumen general.',
      '',
      '## Próximos pasos',
      '- Enviar propuesta (Pol)',
      '* **Revisar** presupuesto',
      '',
      '## Otra cosa',
      '- no es un paso',
    ].join('\n')
    expect(extractNextSteps(text)).toEqual(['Enviar propuesta (Pol)', 'Revisar presupuesto'])
  })

  it('returns nothing without the heading', () => {
    expect(extractNextSteps('- una viñeta suelta')).toEqual([])
    expect(extractNextSteps(null)).toEqual([])
  })
})
