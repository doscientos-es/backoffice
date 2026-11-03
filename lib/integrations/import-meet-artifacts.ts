import { isGoogleEnabled } from '@/lib/env'
import { resolveSubject } from '@/lib/google/client'
import { readDocumentText } from '@/lib/google/drive'
import {
  getConferenceParticipants,
  listConferenceArtifacts,
  listConferenceRecords,
} from '@/lib/google/meet'
import { extractNextSteps, leadDidNotShow, parseMeetingInfo } from '@/lib/leads/meeting-info'
import { summarizeMeeting } from '@/lib/leads/meeting-summary'
import { cleanTranscript } from '@/lib/leads/transcript'
import { scopedLogger } from '@/lib/logger'
import { dispatchNotifications } from '@/lib/notifications/dispatch'
import { createAdminClient } from '@/lib/supabase/admin'

const log = scopedLogger('integrations.meet-artifacts')
const WINDOW_DAYS = 30
const BATCH_SIZE = 100

type MeetingPayload = Record<string, unknown> & {
  meet_url?: string
  start?: string
  end?: string
  calendar_event_id?: string
  organizer_email?: string
  attendees?: string[]
  meet_artifacts?: { processed_at?: string; last_checked_at?: string }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function meetingCode(url: string): string | null {
  const match = url.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i)
  return match?.[1]?.toLowerCase() ?? null
}

function closestConference<T extends { startTime: string }>(records: T[], target: Date): T | null {
  return (
    records
      .map((item) => ({
        item,
        distance: Math.abs(new Date(item.startTime).getTime() - target.getTime()),
      }))
      .filter(({ distance }) => distance <= 18 * 60 * 60 * 1000)
      .sort((a, b) => a.distance - b.distance)[0]?.item ?? null
  )
}

function cleanText(value: string): string {
  return value.replaceAll(String.fromCharCode(0), '').trim()
}

/** Polls recent CRM meetings and imports Google Meet's generated artifacts once ready. */
export async function importRecentMeetArtifacts(): Promise<{
  scanned: number
  imported: number
  pending: number
  failed: number
}> {
  if (!isGoogleEnabled()) throw new Error('Google Workspace no está configurado')
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const retryBefore = new Date(Date.now() - 15 * 60_000).toISOString()
  const { data: rows, error } = await supabase
    .from('lead_interactions')
    .select('id, lead_id, performed_by, payload, body, created_at')
    .eq('type', 'meeting')
    .gte('created_at', cutoff)
    .not('payload->>meet_url', 'is', null)
    .is('payload->meet_artifacts->>processed_at', null)
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE)
  if (error) throw new Error(error.message)

  let imported = 0
  let pending = 0
  let failed = 0
  const performerIds = Array.from(
    new Set((rows ?? []).map((row) => row.performed_by).filter((id): id is string => Boolean(id))),
  )
  const { data: performers } = performerIds.length
    ? await supabase.from('team_members').select('id, email').in('id', performerIds)
    : { data: [] }
  const performerEmails = new Map((performers ?? []).map((member) => [member.id, member.email]))

  for (const row of rows ?? []) {
    const payload = record(row.payload) as MeetingPayload
    if (payload.meet_artifacts?.processed_at) continue
    const lastCheckedAt = payload.meet_artifacts?.last_checked_at
    if (lastCheckedAt && lastCheckedAt > retryBefore) continue
    const meetUrl = typeof payload.meet_url === 'string' ? payload.meet_url : ''
    const code = meetingCode(meetUrl)
    const start =
      typeof payload.start === 'string' ? new Date(payload.start) : new Date(row.created_at)
    if (!code || Number.isNaN(start.getTime()) || start.getTime() > Date.now() - 2 * 60_000)
      continue

    try {
      const organizerEmail =
        typeof payload.organizer_email === 'string'
          ? payload.organizer_email
          : row.performed_by
            ? performerEmails.get(row.performed_by)
            : undefined
      const subject = resolveSubject(organizerEmail)
      const conferences = await listConferenceRecords({
        subject,
        meetingCode: code,
        from: new Date(start.getTime() - 18 * 60 * 60 * 1000),
        to: new Date(start.getTime() + 18 * 60 * 60 * 1000),
      })
      const conference = closestConference(conferences, start)
      if (!conference) {
        await supabase
          .from('lead_interactions')
          .update({
            payload: {
              ...payload,
              meet_artifacts: {
                ...record(payload.meet_artifacts),
                last_checked_at: new Date().toISOString(),
              },
            },
          })
          .eq('id', row.id)
        pending++
        continue
      }

      const artifacts = await listConferenceArtifacts({
        subject,
        conferenceRecord: conference.name,
      })
      const participants = await getConferenceParticipants({
        subject,
        conferenceRecord: conference.name,
      })
      const readyTranscript = artifacts.transcripts.find((item) => item.state === 'FILE_GENERATED')
      const readyNotes = artifacts.smartNotes.find((item) => item.state === 'FILE_GENERATED')
      const transcriptId = readyTranscript?.docsDestination?.document
      const notesId = readyNotes?.docsDestination?.document
      if (!transcriptId && !notesId) {
        await supabase
          .from('lead_interactions')
          .update({
            payload: {
              ...payload,
              meet_artifacts: {
                ...record(payload.meet_artifacts),
                last_checked_at: new Date().toISOString(),
              },
            },
          })
          .eq('id', row.id)
        pending++
        continue
      }

      let notes = ''
      if (notesId) {
        try {
          notes = cleanText(await readDocumentText(subject, notesId))
        } catch (err) {
          log.warn({ err, interactionId: row.id }, 'meet_notes_read_failed')
        }
      }
      // The source stays in memory only. Do not even download the transcript when notes exist.
      const transcript =
        !notes && transcriptId
          ? cleanTranscript(cleanText(await readDocumentText(subject, transcriptId)))
          : ''
      if (!transcript && !notes) {
        throw new Error(
          'Los documentos de Meet están generados, pero no se pudo leer su contenido.',
        )
      }
      const summary = await summarizeMeeting(notes, transcript)
      if (!summary.text.trim()) {
        throw new Error('No se pudo generar el resumen de Meet; se reintentará la importación.')
      }
      const importedAt = new Date().toISOString()
      const durationMinutes = conference.endTime
        ? Math.max(
            0,
            Math.round(
              (new Date(conference.endTime).getTime() - new Date(conference.startTime).getTime()) /
                60_000,
            ),
          )
        : null
      const { data: leadRow } = await supabase
        .from('leads')
        .select('email')
        .eq('id', row.lead_id)
        .maybeSingle()
      const leadNoShow = leadDidNotShow(
        parseMeetingInfo({
          attendees: payload.attendees,
          meet_artifacts: {
            processed_at: importedAt,
            participants: participants.map((participant) => ({
              name: participant.signedinUser?.displayName ?? participant.anonymousUser?.displayName,
              email: participant.email ?? null,
            })),
          },
        }),
        leadRow?.email ?? null,
      )
      const meetingArtifacts = {
        lead_no_show: leadNoShow,
        processed_at: importedAt,
        last_checked_at: importedAt,
        conference_record: conference.name,
        actual_start: conference.startTime,
        actual_end: conference.endTime ?? null,
        duration_minutes: durationMinutes,
        participants: participants.map((participant) => ({
          name:
            participant.signedinUser?.displayName ??
            participant.anonymousUser?.displayName ??
            participant.phoneUser?.displayName ??
            participant.email ??
            participant.name.split('/').at(-1) ??
            participant.name,
          email: participant.email ?? null,
          start: participant.earliestStartTime ?? null,
          end: participant.latestEndTime ?? null,
        })),
        transcript_document_id: transcriptId ?? null,
        transcript_url: transcriptId
          ? `https://docs.google.com/document/d/${transcriptId}/view`
          : null,
        notes_document_id: notesId ?? null,
        notes_url: notesId ? `https://docs.google.com/document/d/${notesId}/view` : null,
        storage_mode: 'summary_only',
        has_notes: false,
        has_transcript: false,
        transcript_truncated: false,
        summary_truncated: summary.truncated,
        summary: summary.text || null,
      }
      // Row locking and a transaction keep summary + tasks atomic and safe on retries.
      const { data: finalized, error: updateError } = await supabase.rpc(
        'finalize_lead_meeting_summary',
        {
          p_interaction_id: row.id,
          p_artifacts: meetingArtifacts,
          p_steps: extractNextSteps(summary.text),
        },
      )
      if (updateError) throw new Error(updateError.message)
      if (!record(finalized).processed) continue

      let meetingTasks: Array<{
        id: string
        assignee_id: string | null
        created_by: string | null
      }> = []
      if (payload.calendar_event_id) {
        const { data } = await supabase
          .from('tasks')
          .select('id, assignee_id, created_by')
          .eq('lead_id', row.lead_id)
          .eq('kind', 'reminder')
          .eq('action_type', 'meeting')
          .is('completed_at', null)
          .gte('start_at', new Date(start.getTime() - 60 * 60_000).toISOString())
          .lte('start_at', new Date(start.getTime() + 60 * 60_000).toISOString())
        meetingTasks = data ?? []
      }
      const taskIds = meetingTasks.map((task) => task.id)
      const completedTaskIds: string[] = []
      if (taskIds.length) {
        const { data: completed } = await supabase
          .from('tasks')
          .update({ status: 'done', completed_at: importedAt })
          .in('id', taskIds)
          .is('completed_at', null)
          .select('id')
        completedTaskIds.push(...(completed ?? []).map((task) => task.id))
      }

      const { data: taskMembers } = completedTaskIds.length
        ? await supabase.from('task_members').select('member_id').in('task_id', completedTaskIds)
        : { data: [] }
      const { data: leadOwner } = await supabase
        .from('leads')
        .select('assigned_to')
        .eq('id', row.lead_id)
        .maybeSingle()
      const participantEmails = new Set(
        participants
          .map((participant) => participant.email)
          .filter((email): email is string => Boolean(email))
          .map((email) => email.toLowerCase()),
      )
      const { data: team } = await supabase.from('team_members').select('id, email, name')
      const normalizedParticipantNames = participants.map((participant) =>
        (
          participant.anonymousUser?.displayName ??
          participant.signedinUser?.displayName ??
          participant.phoneUser?.displayName ??
          participant.email ??
          participant.name.split('/').at(-1) ??
          participant.name
        )
          .toLocaleLowerCase('es-ES')
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim(),
      )
      const internalParticipantIds = (team ?? [])
        .filter(
          (member) =>
            participantEmails.has(member.email.toLowerCase()) ||
            normalizedParticipantNames.includes(
              member.name
                .toLocaleLowerCase('es-ES')
                .replace(/[^\p{L}\p{N}]+/gu, ' ')
                .trim(),
            ),
        )
        .map((member) => member.id)
      const recipientIds = Array.from(
        new Set(
          [
            ...internalParticipantIds,
            ...(taskMembers ?? []).map((member) => member.member_id),
            ...meetingTasks
              .filter((task) => completedTaskIds.includes(task.id))
              .flatMap((task) => [task.assignee_id, task.created_by]),
            row.performed_by,
            leadOwner?.assigned_to,
          ].filter((id): id is string => Boolean(id)),
        ),
      )
      if (recipientIds.length) {
        await dispatchNotifications({
          recipientIds,
          actorId: null,
          eventType: 'meeting_synced',
          entityType: 'lead',
          entityId: row.lead_id,
          body: `Meet está listo: ${durationMinutes ?? 'duración no disponible'} min · ${participants.length} participante(s)${summary.text ? ' · resumen disponible' : ''}.`,
          link: `/leads/${row.lead_id}`,
          data: { interactionId: row.id, meetingUrl: meetUrl },
        })
      }
      imported++
    } catch (err) {
      failed++
      await supabase
        .from('lead_interactions')
        .update({
          payload: {
            ...payload,
            meet_artifacts: {
              ...record(payload.meet_artifacts),
              last_checked_at: new Date().toISOString(),
            },
          },
        })
        .eq('id', row.id)
        .is('payload->meet_artifacts->>processed_at', null)
      log.error({ err, interactionId: row.id, leadId: row.lead_id }, 'meet_artifact_import_failed')
    }
  }

  const result = { scanned: rows?.length ?? 0, imported, pending, failed }
  log.info(result, 'meet_artifact_import_completed')
  return result
}
