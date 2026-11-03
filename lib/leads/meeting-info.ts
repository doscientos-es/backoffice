/** Pure readers for the Meet data stored in a `meeting` lead interaction payload. */

export type MeetingParticipant = {
  name: string | null
  email: string | null
  start: string | null
  end: string | null
}

export type MeetingInfo = {
  meetUrl: string | null
  start: string | null
  attendees: string[]
  importedAt: string | null
  lastCheckedAt: string | null
  durationMinutes: number | null
  participants: MeetingParticipant[]
  summary: string | null
  hasNotes: boolean
  hasTranscript: boolean
  transcriptTruncated: boolean
  summaryTruncated: boolean
  organizerEmail: string | null
  actualStart: string | null
  actualEnd: string | null
  notesUrl: string | null
  transcriptUrl: string | null
  recordingUrl: string | null
  /** Stored at import time. `null` means it was never computed (meetings imported before). */
  storedNoShow: boolean | null
}

function rec(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function parseMeetingInfo(payload: unknown): MeetingInfo {
  const data = rec(payload)
  const artifacts = rec(data?.meet_artifacts)
  const participants = Array.isArray(artifacts?.participants) ? artifacts.participants : []
  return {
    meetUrl: str(data?.meet_url),
    start: str(data?.start),
    attendees: Array.isArray(data?.attendees)
      ? data.attendees.filter((v): v is string => typeof v === 'string')
      : [],
    importedAt: str(artifacts?.processed_at),
    lastCheckedAt: str(artifacts?.last_checked_at),
    durationMinutes:
      typeof artifacts?.duration_minutes === 'number' ? artifacts.duration_minutes : null,
    participants: participants.map((item) => {
      const p = rec(item)
      return {
        name: str(p?.name),
        email: str(p?.email),
        start: str(p?.start),
        end: str(p?.end),
      }
    }),
    summary: str(artifacts?.summary),
    hasNotes: artifacts?.has_notes === true,
    hasTranscript: artifacts?.has_transcript === true,
    transcriptTruncated: artifacts?.transcript_truncated === true,
    summaryTruncated: artifacts?.summary_truncated === true,
    organizerEmail: str(data?.organizer_email),
    actualStart: str(artifacts?.actual_start),
    actualEnd: str(artifacts?.actual_end),
    notesUrl: str(artifacts?.notes_url),
    transcriptUrl: str(artifacts?.transcript_url),
    recordingUrl: str(artifacts?.recording_url),
    storedNoShow: typeof artifacts?.lead_no_show === 'boolean' ? artifacts.lead_no_show : null,
  }
}

/** The stored mark wins (the importer sets it, a person can clear it); otherwise compute it. */
export function isNoShow(info: MeetingInfo, leadEmail: string | null): boolean {
  return info.storedNoShow ?? leadDidNotShow(info, leadEmail)
}

/**
 * True only when the meeting was imported, the lead was invited, and nobody who joined can be the
 * lead. Anonymous guests have no email, so with any of them present we cannot tell and say no.
 */
export function leadDidNotShow(info: MeetingInfo, leadEmail: string | null): boolean {
  if (!info.importedAt || !leadEmail) return false
  const lead = leadEmail.trim().toLowerCase()
  if (!info.attendees.some((email) => email.trim().toLowerCase() === lead)) return false
  if (info.participants.some((p) => !p.email)) return false
  return !info.participants.some((p) => p.email?.trim().toLowerCase() === lead)
}

export type MeetingChip = { text: string; tone: 'success' | 'muted' | 'warning' }

/** Short status chips for the timeline card of a meeting. */
export function meetingChips(
  info: MeetingInfo,
  opts: { leadEmail: string | null; now?: Date },
): MeetingChip[] {
  const now = opts.now ?? new Date()
  if (!info.importedAt) {
    const started = info.start ? new Date(info.start).getTime() <= now.getTime() : false
    return [
      {
        text: started ? 'Esperando notas de Meet' : 'Meet programada',
        tone: started ? 'warning' : 'muted',
      },
    ]
  }
  const chips: MeetingChip[] = []
  if (isNoShow(info, opts.leadEmail))
    chips.push({ text: 'El lead no se presentó', tone: 'warning' })
  if (info.durationMinutes !== null)
    chips.push({ text: `${info.durationMinutes} min`, tone: 'muted' })
  if (info.participants.length) {
    const n = info.participants.length
    chips.push({ text: `${n} ${n === 1 ? 'participante' : 'participantes'}`, tone: 'muted' })
  }
  if (info.summary) chips.push({ text: 'Resumen listo', tone: 'success' })
  else if (info.hasTranscript) chips.push({ text: 'Transcripción lista', tone: 'success' })
  else chips.push({ text: 'Sin transcripción', tone: 'muted' })
  return chips
}

const NEXT_STEPS_HEADING =
  /^\s*(?:#{1,6}\s*|\*\*)?\s*(?:pr[oó]ximos pasos|siguientes pasos|pasos siguientes|next steps)\b.*$/i

/** Bullet lines under a "Próximos pasos" heading of the summary or Gemini notes. */
export function extractNextSteps(text: string | null, max = 8): string[] {
  if (!text) return []
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((line) => NEXT_STEPS_HEADING.test(line))
  if (start === -1) return []
  const steps: string[] = []
  for (const line of lines.slice(start + 1)) {
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*\S)\s*$/.exec(line)
    if (bullet?.[1]) {
      steps.push(bullet[1].replace(/\*\*/g, '').trim())
      if (steps.length >= max) break
    } else if (/^\s*#{1,6}\s/.test(line) || (steps.length > 0 && !line.trim())) break
  }
  return steps
}
