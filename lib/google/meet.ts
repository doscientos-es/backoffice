import { GOOGLE_SCOPES, googleFetch } from './client'

const BASE = 'https://meet.googleapis.com/v2'

export type MeetArtifactDoc = {
  name: string
  state: string
  docsDestination?: { document?: string; exportUri?: string }
}

type ConferenceRecord = { name: string; startTime: string; endTime?: string; space?: string }

/** Lists conference instances matching a Meet code near the scheduled time. */
export async function listConferenceRecords(opts: {
  subject: string
  meetingCode: string
  from: Date
  to: Date
}): Promise<ConferenceRecord[]> {
  const filter = `space.meeting_code = "${opts.meetingCode}" AND start_time >= "${opts.from.toISOString()}" AND start_time <= "${opts.to.toISOString()}"`
  const params = new URLSearchParams({ filter, pageSize: '100' })
  const result = await googleFetch<{ conferenceRecords?: ConferenceRecord[] }>(
    opts.subject,
    [GOOGLE_SCOPES.meet],
    `${BASE}/conferenceRecords?${params}`,
  )
  return result.conferenceRecords ?? []
}

/** Returns generated transcript and Gemini smart-note document references. */
export async function listConferenceArtifacts(opts: {
  subject: string
  conferenceRecord: string
}): Promise<{ transcripts: MeetArtifactDoc[]; smartNotes: MeetArtifactDoc[] }> {
  const [transcripts, smartNotes] = await Promise.all([
    googleFetch<{ transcripts?: MeetArtifactDoc[] }>(
      opts.subject,
      [GOOGLE_SCOPES.meet],
      `${BASE}/${opts.conferenceRecord}/transcripts?pageSize=100`,
    ),
    googleFetch<{ smartNotes?: MeetArtifactDoc[] }>(
      opts.subject,
      [GOOGLE_SCOPES.meet],
      `${BASE}/${opts.conferenceRecord}/smartNotes?pageSize=100`,
    ).catch(() => ({ smartNotes: [] })),
  ])
  return {
    transcripts: transcripts.transcripts ?? [],
    smartNotes: smartNotes.smartNotes ?? [],
  }
}
