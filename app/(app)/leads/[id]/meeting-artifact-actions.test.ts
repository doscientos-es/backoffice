import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadMeetingArtifact } from './meeting-artifact-actions'

const { requireUser, from, select, eq, maybeSingle } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireUser, requireRole: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ from }) }))

const input = {
  leadId: '00000000-0000-4000-8000-000000000001',
  interactionId: '00000000-0000-4000-8000-000000000002',
  kind: 'transcript' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUser.mockResolvedValue({ id: 'test-user' })
  const builder = { select, eq, maybeSingle }
  from.mockReturnValue(builder)
  select.mockReturnValue(builder)
  eq.mockReturnValue(builder)
  maybeSingle.mockResolvedValue({
    data: { transcript_text: 'Texto', transcript_truncated: true },
    error: null,
  })
})

describe('loadMeetingArtifact', () => {
  it('reads only the requested document with both lead and interaction filters', async () => {
    expect(await loadMeetingArtifact(input)).toEqual({ ok: true, text: 'Texto', truncated: true })
    expect(requireUser).toHaveBeenCalledOnce()
    expect(from).toHaveBeenCalledWith('lead_interaction_artifacts')
    expect(select).toHaveBeenCalledWith('transcript_text, transcript_truncated')
    expect(eq).toHaveBeenCalledWith('lead_id', input.leadId)
    expect(eq).toHaveBeenCalledWith('interaction_id', input.interactionId)
  })

  it('reads notes separately without marking them as a truncated transcript', async () => {
    maybeSingle.mockResolvedValue({
      data: { notes_text: 'Notas', transcript_truncated: true },
      error: null,
    })
    expect(await loadMeetingArtifact({ ...input, kind: 'notes' })).toEqual({
      ok: true,
      text: 'Notas',
      truncated: false,
    })
    expect(select).toHaveBeenCalledWith('notes_text, transcript_truncated')
  })

  it('does not query without authentication or with invalid IDs', async () => {
    requireUser.mockRejectedValueOnce(new Error('Unauthorized'))
    expect((await loadMeetingArtifact(input)).ok).toBe(false)
    expect((await loadMeetingArtifact({ ...input, leadId: 'invalid' })).ok).toBe(false)
    expect(from).not.toHaveBeenCalled()
  })

  it('does not return content when RLS hides the row or the database fails', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    expect((await loadMeetingArtifact(input)).ok).toBe(false)
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied', code: '42501' },
    })
    expect(await loadMeetingArtifact(input)).toMatchObject({ ok: false, error: expect.any(String) })
  })
})
