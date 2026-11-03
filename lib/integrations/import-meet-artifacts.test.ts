import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readDocumentText } from '@/lib/google/drive'
import { summarizeMeeting } from '@/lib/leads/meeting-summary'

import { importRecentMeetArtifacts } from './import-meet-artifacts'

const db = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; values: Record<string, unknown> }>,
  finalize: vi.fn(),
  notes: 'Notas',
  hasNotes: true,
  transcript: `${'x'.repeat(105_000)}\nDecisión final`,
  start: new Date(Date.now() - 3_600_000).toISOString(),
}))

vi.mock('@/lib/env', () => ({ isGoogleEnabled: () => true }))
vi.mock('@/lib/google/client', () => ({ resolveSubject: () => 'member@example.test' }))
vi.mock('@/lib/google/drive', () => ({
  readDocumentText: vi.fn(),
}))
vi.mock('@/lib/google/meet', () => ({
  listConferenceRecords: async () => [{ name: 'conference-test', startTime: db.start }],
  getConferenceParticipants: async () => [],
  listConferenceArtifacts: async () => ({
    transcripts: [{ state: 'FILE_GENERATED', docsDestination: { document: 'transcript-test' } }],
    smartNotes: db.hasNotes
      ? [{ state: 'FILE_GENERATED', docsDestination: { document: 'notes-test' } }]
      : [],
  }),
}))
vi.mock('@/lib/leads/meeting-summary', () => ({ summarizeMeeting: vi.fn() }))
vi.mock('@/lib/notifications/dispatch', () => ({ dispatchNotifications: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: db.finalize,
    from: (table: string) => {
      let written = false
      const result = () => {
        if (table === 'team_members') return { data: [], error: null }
        if (table === 'leads') return { data: { email: null, assigned_to: null }, error: null }
        return {
          data: written
            ? [{ id: 'interaction-test' }]
            : [
                {
                  id: 'interaction-test',
                  lead_id: 'lead-test',
                  performed_by: null,
                  body: null,
                  created_at: db.start,
                  payload: { meet_url: 'https://meet.google.com/abc-defg-hij', start: db.start },
                },
              ],
          error: null,
        }
      }
      const builder = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        not: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (values: Record<string, unknown>) => {
          written = true
          db.writes.push({ table, values })
          return builder
        },
        maybeSingle: async () => result(),
        // biome-ignore lint/suspicious/noThenProperty: Supabase's query builders are thenable
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
      }
      return builder
    },
  }),
}))

beforeEach(() => {
  db.writes = []
  db.notes = 'Notas'
  db.hasNotes = true
  db.finalize
    .mockReset()
    .mockResolvedValue({ data: { processed: true, task_ids: ['task-test'] }, error: null })
  vi.mocked(readDocumentText)
    .mockReset()
    .mockImplementation(async (_subject, id) =>
      id === 'transcript-test' ? db.transcript : db.notes,
    )
  vi.mocked(summarizeMeeting).mockReset().mockResolvedValue({
    text: 'Resumen\nPróximos pasos\n- Enviar propuesta (Ana)',
    truncated: false,
  })
})

describe('importRecentMeetArtifacts storage', () => {
  it('reads only Gemini notes and atomically saves the summary and explicit next steps', async () => {
    expect(await importRecentMeetArtifacts()).toEqual({
      scanned: 1,
      imported: 1,
      pending: 0,
      failed: 0,
    })
    expect(readDocumentText).toHaveBeenCalledTimes(1)
    expect(readDocumentText).toHaveBeenCalledWith('member@example.test', 'notes-test')
    expect(summarizeMeeting).toHaveBeenCalledWith('Notas', '')
    expect(db.finalize).toHaveBeenCalledWith(
      'finalize_lead_meeting_summary',
      expect.objectContaining({
        p_interaction_id: 'interaction-test',
        p_steps: ['Enviar propuesta (Ana)'],
        p_artifacts: expect.objectContaining({
          storage_mode: 'summary_only',
          has_transcript: false,
          has_notes: false,
          summary: 'Resumen\nPróximos pasos\n- Enviar propuesta (Ana)',
        }),
      }),
    )
    const artifacts = db.finalize.mock.calls[0]?.[1]?.p_artifacts
    expect(artifacts).toBeDefined()
    expect(artifacts).not.toHaveProperty('transcript_text')
    expect(artifacts).not.toHaveProperty('notes_text')
    expect(db.writes).toEqual([])
  })

  it('leaves the meeting retryable when the summary/tasks transaction fails', async () => {
    db.finalize.mockResolvedValue({ data: null, error: { message: 'Transaction failed' } })
    expect(await importRecentMeetArtifacts()).toEqual({
      scanned: 1,
      imported: 0,
      pending: 0,
      failed: 1,
    })
    const retry = db.writes.find((write) => write.table === 'lead_interactions')
    const payload = retry?.values.payload as { meet_artifacts: Record<string, unknown> }
    expect(payload.meet_artifacts).toHaveProperty('last_checked_at')
    expect(payload.meet_artifacts).not.toHaveProperty('processed_at')
  })

  it('uses the transcript temporarily without saving it when there are no notes', async () => {
    db.hasNotes = false
    expect((await importRecentMeetArtifacts()).imported).toBe(1)
    expect(readDocumentText).toHaveBeenCalledTimes(1)
    expect(readDocumentText).toHaveBeenCalledWith('member@example.test', 'transcript-test')
    expect(summarizeMeeting).toHaveBeenCalledWith('', db.transcript)
    expect(db.writes).toEqual([])
  })

  it('falls back to the transcript when Gemini notes cannot be read', async () => {
    vi.mocked(readDocumentText).mockRejectedValueOnce(new Error('Notes unavailable'))
    expect((await importRecentMeetArtifacts()).imported).toBe(1)
    expect(summarizeMeeting).toHaveBeenCalledWith('', db.transcript)
  })

  it('falls back to the transcript when the notes document is empty', async () => {
    db.notes = ''
    expect((await importRecentMeetArtifacts()).imported).toBe(1)
    expect(readDocumentText).toHaveBeenCalledTimes(2)
    expect(summarizeMeeting).toHaveBeenCalledWith('', db.transcript)
  })

  it('does not finalize a meeting without a usable summary', async () => {
    vi.mocked(summarizeMeeting).mockResolvedValue({ text: '', truncated: true })
    expect((await importRecentMeetArtifacts()).failed).toBe(1)
    expect(db.finalize).not.toHaveBeenCalled()
  })

  it('stops post-processing when another importer already finalized the meeting', async () => {
    db.finalize.mockResolvedValue({ data: { processed: false }, error: null })
    expect(await importRecentMeetArtifacts()).toEqual({
      scanned: 1,
      imported: 0,
      pending: 0,
      failed: 0,
    })
    expect(db.writes).toEqual([])
  })
})
