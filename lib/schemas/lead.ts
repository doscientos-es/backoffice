import { z } from 'zod'

import { todayIsoLocal } from '@/lib/utils/date'

import { assignableUuid, optionalEmail, optionalText, optionalUuid, requiredText } from './common'

/**
 * Zod schemas for the `leads` domain.
 */

export const LeadStatus = z.enum([
  'new',
  'contacted',
  'in_conversation',
  /** Legacy stage, replaced by `contacted` / `in_conversation`. */
  'qualifying',
  'quoted',
  'won',
  'lost',
  'not_interested',
  'archived',
])

export type LeadStatusType = z.infer<typeof LeadStatus>

export const CreateLeadInput = z.object({
  name: requiredText(160, 'El nombre es obligatorio'),
  /** Short display name shown in lists. Falls back to `name` when absent. */
  alias: optionalText(100),
  email: optionalEmail,
  phone: optionalText(40),
  company: optionalText(160),
  source: optionalText(80),
  language: z.enum(['es', 'ca', 'en']).nullable().optional(),
  notes: optionalText(4000),
  estimated_value: z.number().min(0).max(99_999_999.99).nullable().optional(),
  assigned_to: assignableUuid.optional(),
  company_size: optionalText(80),
  solution_type: optionalText(80),
  urgency: optionalText(80),
})

export const UpdateLeadInput = CreateLeadInput.extend({
  id: z.string().uuid(),
  expected_version: z.coerce.number().int().positive(),
  estimated_value: z.number().min(0).max(99_999_999.99).nullable().optional(),
})

/** Imports emails that already exist in the configured Gmail mailboxes. */
export const SyncLeadGmailInput = z.object({ leadId: z.string().uuid() })

export const ConvertLeadInput = z.object({
  leadId: z.string().uuid(),
  name: requiredText(160, 'El nombre es obligatorio'),
  /** Carried over from the lead's alias and stored as `clients.label`. */
  alias: optionalText(100),
  nif: requiredText(20, 'El NIF es obligatorio'),
  billing_address: requiredText(400, 'La dirección es obligatoria'),
  email: optionalEmail,
  phone: optionalText(40),
  contact_person: optionalText(160),
  notes: optionalText(4000),
})

export const UpdateLeadStatusInput = z
  .object({
    leadId: z.string().uuid(),
    status: LeadStatus,
    lostReason: optionalText(500),
  })
  .refine(
    (v) => {
      const isClosure = v.status === 'lost' || v.status === 'not_interested'
      return isClosure || !v.lostReason
    },
    {
      message: 'El motivo solo aplica a estados de cierre',
      path: ['lostReason'],
    },
  )
  .refine(
    (v) => {
      const isClosure = v.status === 'lost' || v.status === 'not_interested'
      return !isClosure || !!v.lostReason
    },
    {
      message: 'Indica un motivo de cierre',
      path: ['lostReason'],
    },
  )

export const CALL_OUTCOMES = [
  'connected',
  'voicemail',
  'no_answer',
  'busy',
  'wrong_number',
] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

/** Unanswered calls: there is nobody to take notes from, so none are expected. */
export const CALL_OUTCOMES_WITHOUT_DETAILS = new Set<CallOutcome>([
  'voicemail',
  'no_answer',
  'busy',
  'wrong_number',
])

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

const CallDate = z
  .string()
  .refine(isCalendarDate, 'Fecha de llamada no válida')
  .refine(
    (value) => value <= todayIsoLocal(),
    'La fecha de la llamada no puede ser posterior a hoy',
  )

export const StartLeadCallInput = z.object({
  leadId: z.string().uuid(),
  source: z.enum(['desktop', 'qr', 'mobile']).default('desktop'),
})

export const CallSessionInput = z.object({
  leadId: z.string().uuid(),
  sessionId: z.string().uuid(),
})

export const LogCallInput = z
  .object({
    leadId: z.string().uuid(),
    notes: optionalText(8000),
    transcript: optionalText(50000),
    callSessionId: z.string().uuid().optional(),
    durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
    outcome: z.enum(CALL_OUTCOMES).optional(),
    relatedContact: z
      .object({
        name: requiredText(160, 'El nombre del contacto es obligatorio'),
        email: optionalEmail,
        phone: optionalText(40),
        role: optionalText(120),
      })
      .optional(),
    /** The calendar date when the actual call happened, not when it was logged. */
    callDate: CallDate.default(() => todayIsoLocal()),
  })
  .refine(
    (v) =>
      (v.outcome !== undefined && CALL_OUTCOMES_WITHOUT_DETAILS.has(v.outcome)) ||
      (v.notes?.trim().length ?? 0) > 0 ||
      (v.transcript?.trim().length ?? 0) > 0,
    {
      message: 'Añade unas notas o la transcripción de la llamada',
      path: ['notes'],
    },
  )
  .refine((value) => !value.relatedContact || value.outcome === 'connected', {
    message: 'Solo se puede asociar otra persona a una llamada atendida',
    path: ['relatedContact'],
  })

export const UpdateLeadCallInput = z
  .object({
    interactionId: z.string().uuid(),
    leadId: z.string().uuid(),
    notes: optionalText(8000),
    transcript: optionalText(50000),
    durationMinutes: z.coerce.number().int().min(0).max(600).optional(),
    outcome: z.enum(CALL_OUTCOMES).optional(),
    callDate: CallDate,
  })
  .refine(
    (v) =>
      (v.outcome !== undefined && CALL_OUTCOMES_WITHOUT_DETAILS.has(v.outcome)) ||
      (v.notes?.trim().length ?? 0) > 0 ||
      (v.transcript?.trim().length ?? 0) > 0,
    {
      message: 'Añade unas notas o la transcripción de la llamada',
      path: ['notes'],
    },
  )

export const LogEmailInput = z.object({
  leadId: z.string().uuid(),
  direction: z.enum(['incoming', 'outgoing']),
  subject: requiredText(300, 'El asunto es obligatorio'),
  bodyHtml: optionalText(50000),
  counterparty: optionalEmail,
})

export const LogNoteInput = z.object({
  leadId: z.string().uuid(),
  content: requiredText(8000, 'La nota no puede estar vacía'),
})

export const DismissMeetingNoShowInput = z.object({
  leadId: z.string().uuid(),
  interactionId: z.string().uuid(),
})

export const LeadContactInput = z.object({
  leadId: z.string().uuid(),
  name: requiredText(160, 'El nombre es obligatorio'),
  email: optionalEmail,
  phone: optionalText(40),
  role: optionalText(120),
  company: optionalText(160),
  notes: optionalText(2000),
  source: z.enum(['manual', 'meet']).default('manual'),
  sourceInteractionId: optionalUuid,
})

export const UpdateLeadContactInput = LeadContactInput.extend({
  contactId: z.string().uuid(),
  expectedVersion: z.coerce.number().int().positive(),
})

export const ArchiveLeadContactInput = z.object({
  leadId: z.string().uuid(),
  contactId: z.string().uuid(),
})

export const DismissLeadMeetContactSuggestionInput = z.object({
  leadId: z.string().uuid(),
  suggestionKey: requiredText(320, 'Sugerencia no válida'),
  name: requiredText(160, 'El nombre es obligatorio'),
  email: optionalEmail,
  phone: optionalText(40),
})

export const LogWhatsAppInput = z.object({
  leadId: z.string().uuid(),
  content: requiredText(8000, 'El mensaje no puede estar vacío'),
})

export const DeleteLeadInteractionInput = z.object({
  interactionId: z.string().uuid(),
  leadId: z.string().uuid(),
})

export const SendEmailToLeadInput = z.object({
  leadId: z.string().uuid(),
  templateSlug: z.string().min(1).optional(),
  ccAdmins: z.boolean().default(false),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  includeSignature: z.boolean().default(true),
  to: z.string().email(),
})

export const AssignLeadOwnerInput = z.object({
  leadId: z.string().uuid(),
  assigneeId: assignableUuid,
})

/** Schedule a meeting on the shared calendar and log it as an interaction. */
export const ScheduleLeadMeetingInput = z.object({
  leadId: z.string().uuid(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  title: requiredText(200, 'El título es obligatorio'),
  description: optionalText(4000),
  /** Emails to invite (lead + any team members). */
  attendeeEmails: z.array(z.string().email()).max(20).optional(),
  /** Attach a Google Meet link. Default true. */
  withMeet: z.boolean().default(true),
  /** Optional project this meeting is linked to. */
  projectId: z.string().uuid().optional(),
})

/**
 * The 6 Mom Test signals used to spot a qualified lead: real problem,
 * awareness, previous attempts to solve it, decision power or budget,
 * accessibility, and comparison with other companies. Each is tri-state
 * (null = unset).
 */
export const MOM_TEST_SIGNALS = [
  'real_problem',
  'aware_problem',
  'tried_solutions',
  'decision_power_or_budget',
  'accessible',
  'comparing_other_companies',
] as const
export type MomTestSignal = (typeof MOM_TEST_SIGNALS)[number]

export const UpdateLeadMomTestInput = z.object({
  leadId: z.string().uuid(),
  signal: z.enum(MOM_TEST_SIGNALS),
  value: z.boolean().nullable(),
})
