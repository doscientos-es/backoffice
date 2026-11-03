import { describe, expect, it } from 'vitest'

import { chunkTranscript, cleanTranscript, truncateAtLine } from './transcript'

describe('cleanTranscript', () => {
  it('drops blank runs, repeated lines and filler-only lines but keeps content', () => {
    const text = [
      'Pol: Hola, ¿qué tal?',
      '',
      '',
      'Ana: mm',
      'Ana: vale.',
      'Ana: Necesitamos un CRM para 12 comerciales.',
      'Ana: Necesitamos un CRM para 12 comerciales.',
      'eh...',
      'Pol: Perfecto, os envío una propuesta.',
    ].join('\n')
    expect(cleanTranscript(text)).toBe(
      [
        'Pol: Hola, ¿qué tal?',
        'Ana: Necesitamos un CRM para 12 comerciales.',
        'Pol: Perfecto, os envío una propuesta.',
      ].join('\n'),
    )
  })

  it('does not remove a short line that carries information', () => {
    expect(cleanTranscript('Ana: No, el presupuesto es 5000')).toBe(
      'Ana: No, el presupuesto es 5000',
    )
  })
})

describe('truncateAtLine', () => {
  it('leaves short text alone and flags the cut otherwise', () => {
    expect(truncateAtLine('abc', 10)).toEqual({ text: 'abc', truncated: false })
    const long = `${'a'.repeat(90)}\n${'b'.repeat(50)}`
    const result = truncateAtLine(long, 100)
    expect(result.truncated).toBe(true)
    expect(result.text).toBe('a'.repeat(90))
  })
})

describe('chunkTranscript', () => {
  it('splits on line boundaries within the size and loses nothing', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `linea ${i} ${'x'.repeat(20)}`)
    const chunks = chunkTranscript(lines.join('\n'), 200)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((chunk) => chunk.length <= 200)).toBe(true)
    expect(chunks.join('\n')).toBe(lines.join('\n'))
  })
})
