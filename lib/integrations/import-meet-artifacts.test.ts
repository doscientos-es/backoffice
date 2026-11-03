import { beforeEach, describe, expect, it, vi } from 'vitest'

import { summarizeMeeting } from '@/lib/leads/meeting-summary'

import { importRecentMeetArtifacts } from './import-meet-artifacts'

const db = vi.hoisted(() => ({
  writes: [] as Array<{ table: string; values: Record<string, unknown> }>,
  failArtifacts: false,
  transcript: `${'x'.repeat(105_000)}\nDecisión final`,
  start: new Date(Date.now() - 3_600_000).toISOString(),
}))

vi.mock('@/lib/env', () => ({ isGoogleEnabled: () => true }))
vi.mock('@/lib/google/client', () => ({ resolveSubject: () => 'member@example.test' }))
vi.mock('@/lib/google/drive', () => ({
  readDocumentText: async (_subject: string, id: string) =>
    id === 'transcript-test' ? db.transcript : 'Notas',
}))
vi.mock('@/lib/google/meet', () => ({
  listConferenceRecords: async () => [{ name: 'conference-test', startTime: db.start }],
  getConferenceParticipants: async () => [],
  listConferenceArtifacts: async () => ({
    transcripts: [{ state: 'FILE_GENERATED', docsDestination: { document: 'transcript-test' } }],
    smartNotes: [{ state: 'FILE_GENERATED', docsDestination: { document: 'notes-test' } }],
  }),
}))
vi.mock('@/lib/leads/meeting-summary', () => ({ summarizeMeeting: vi.fn() }))
vi.mock('@/lib/notifications/dispatch', () => ({ dispatchNotifications: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let written = false
      const result = () => {
        if (table === 'lead_interaction_artifacts') {
          return { data: null, error: db.failArtifacts ? { message: 'Write failed' } : null }
        }
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
        upsert: (values: Record<string, unknown>) => {
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
  db.failArtifacts = false
  vi.mocked(summarizeMeeting).mockReset().mockResolvedValue({ text: 'Resumen', truncated: false })
})

describe('importRecentMeetArtifacts storage', () => {
  it('stores texts separately before processing, keeps flags and summarizes past the storage limit', async () => {
    expect(await importRecentMeetArtifacts()).toEqual({
      scanned: 1,
      imported: 1,
      pending: 0,
      failed: 0,
    })
    expect(db.writes.map((write) => write.table)).toEqual([
      'lead_interaction_artifacts',
      'lead_interactions',
    ])
    expect(db.writes[0].values).toMatchObject({
      transcript_text: db.transcript.slice(0, 100_000),
      notes_text: 'Notas',
      transcript_truncated: true,
    })
    const payload = db.writes[1].values.payload as { meet_artifacts: Record<string, unknown> }
    expect(payload.meet_artifacts).toMatchObject({
      has_transcript: true,
      has_notes: true,
      transcript_truncated: true,
      summary: 'Resumen',
    })
    expect(payload.meet_artifacts).not.toHaveProperty('transcript_text')
    expect(payload.meet_artifacts).not.toHaveProperty('notes_text')
    expect(summarizeMeeting).toHaveBeenCalledWith('Notas', db.transcript)
  })

  it('does not mark a meeting as processed when saving its texts fails', async () => {
    db.failArtifacts = true
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
})
