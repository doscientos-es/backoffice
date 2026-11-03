import { beforeEach, describe, expect, it, vi } from 'vitest'

import { isAIEnabled, runAIChat } from '@/lib/ai'

import { summarizeMeeting } from './meeting-summary'
import { MAX_SUMMARIZED_TRANSCRIPT_CHARS } from './transcript'

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'test-model' },
  isAIEnabled: vi.fn(),
  runAIChat: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(isAIEnabled).mockReturnValue(true)
  vi.mocked(runAIChat).mockReset().mockResolvedValue('Resumen\nPróximos pasos\n- Enviar propuesta')
})

describe('summarizeMeeting', () => {
  it('prioritizes Gemini notes without adding transcript noise', async () => {
    const result = await summarizeMeeting('Notas', 'Decisión final')
    expect(result.truncated).toBe(false)
    expect(runAIChat).toHaveBeenCalledOnce()
    expect(runAIChat).toHaveBeenCalledWith(expect.objectContaining({ user: 'Notas' }))
  })

  it('summarizes every chunk including the last decision, then merges the partials', async () => {
    const transcript = `${'x'.repeat(105_000)}\nÚltima decisión: enviar la propuesta`
    await summarizeMeeting('', transcript)
    const calls = vi.mocked(runAIChat).mock.calls
    expect(calls).toHaveLength(4)
    expect(
      calls
        .slice(0, -1)
        .map(([args]) => args.user)
        .join(''),
    ).toBe(transcript)
    expect(calls.at(-1)?.[0].user).toContain('Parte 3:')
  })

  it('marks partial coverage and bounds the number of calls for huge meetings', async () => {
    const transcript = 'x'.repeat(MAX_SUMMARIZED_TRANSCRIPT_CHARS + 10_000)
    expect((await summarizeMeeting('', transcript)).truncated).toBe(true)
    expect(runAIChat).toHaveBeenCalledTimes(7)
  })

  it('keeps the summary small when AI is disabled or fails', async () => {
    vi.mocked(isAIEnabled).mockReturnValue(false)
    const notes = 'n'.repeat(10_000)
    expect(await summarizeMeeting(notes, '')).toEqual({
      text: notes.slice(0, 8_000),
      truncated: true,
    })
    expect(runAIChat).not.toHaveBeenCalled()
    vi.mocked(isAIEnabled).mockReturnValue(true)
    vi.mocked(runAIChat).mockRejectedValue(new Error('Summary unavailable'))
    expect(await summarizeMeeting('Notas disponibles', 'Transcripción')).toEqual({
      text: 'Notas disponibles',
      truncated: true,
    })
  })
})
