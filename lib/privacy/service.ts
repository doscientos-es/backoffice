import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

import { writeAuditEvent } from '@/lib/audit/events'

export const PRIVACY_SUBJECT_TYPES = ['lead', 'client', 'team_member'] as const
export type PrivacySubjectType = (typeof PRIVACY_SUBJECT_TYPES)[number]
export type PrivacyRequestType = 'access' | 'erasure'

type PrivacyActor = { id: string | null; role: string }
type PrivacyRequestRecord = {
  id: string
  subject_type: PrivacySubjectType
  subject_id: string
  request_type: PrivacyRequestType
  status: string
}

const SUBJECT_TABLE: Record<PrivacySubjectType, string> = {
  lead: 'leads',
  client: 'clients',
  team_member: 'team_members',
}

export function anonymizationPatch(subjectType: PrivacySubjectType): Record<string, unknown> | null {
  if (subjectType === 'lead') {
    return {
      name: 'Contacto anonimizado',
      email: null,
      phone: null,
      company: null,
      notes: null,
      ai_summary: null,
      raw_payload: null,
      ip: null,
      device: null,
      browser: null,
      marketing_consent: false,
      marketing_consent_withdrawn_at: new Date().toISOString(),
    }
  }
  if (subjectType === 'client') {
    return {
      name: 'Cliente anonimizado',
      email: null,
      phone: null,
      billing_address: null,
      contact_person: null,
      notes: null,
    }
  }
  return null
}

export async function createPrivacyRequest(
  input: {
    subjectType: PrivacySubjectType
    subjectId: string
    requesterEmail?: string | null
    requestType: PrivacyRequestType
    identityVerified: boolean
    scheduledFor?: string | null
    internalNotes?: string | null
  },
  actor: PrivacyActor,
): Promise<{ id: string; status: string }> {
  const admin = createAdminClient()
  const { data: subject, error: subjectError } = await admin
    .from(SUBJECT_TABLE[input.subjectType])
    .select('id')
    .eq('id', input.subjectId)
    .maybeSingle()
  if (subjectError || !subject) throw new Error('El sujeto de privacidad no existe')

  const status = input.identityVerified ? 'verified' : 'received'
  const { data, error } = await admin
    .from('privacy_requests')
    .insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      requester_email: input.requesterEmail?.trim().toLowerCase() || null,
      request_type: input.requestType,
      status,
      identity_verified_at: input.identityVerified ? new Date().toISOString() : null,
      scheduled_for: input.scheduledFor ?? null,
      requested_by: actor.id,
      internal_notes: input.internalNotes?.trim() || null,
    })
    .select('id, status')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'No se pudo crear la solicitud')

  await writeAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    entityType: input.subjectType,
    entityId: input.subjectId,
    action: `privacy_${input.requestType}_requested`,
    metadata: { privacyRequestId: data.id, identityVerified: input.identityVerified },
  })
  return data as { id: string; status: string }
}

async function loadSubjectSnapshot(subjectType: PrivacySubjectType, subjectId: string) {
  const fields: Record<PrivacySubjectType, string> = {
    lead: 'id, name, email, phone, company, source, created_at, marketing_consent, marketing_consent_at',
    client: 'id, name, email, phone, billing_address, contact_person, created_at',
    team_member: 'id, name, email, phone, contact_email, job_title, created_at',
  }
  const { data, error } = await createAdminClient()
    .from(SUBJECT_TABLE[subjectType])
    .select(fields[subjectType])
    .eq('id', subjectId)
    .maybeSingle()
  if (error || !data) throw new Error('No se pudo recuperar los datos del sujeto')
  return data
}

async function blockRequest(id: string, actor: PrivacyActor, reason: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('privacy_requests')
    .update({ status: 'blocked', processed_at: new Date().toISOString(), processed_by: actor.id, result_summary: reason })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function processPrivacyRequest(
  requestId: string,
  actor: PrivacyActor,
): Promise<{ status: 'completed' | 'blocked'; data?: Record<string, unknown> }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('privacy_requests')
    .select('id, subject_type, subject_id, request_type, status')
    .eq('id', requestId)
    .maybeSingle()
  const request = data as PrivacyRequestRecord | null
  if (error || !request) throw new Error('Solicitud de privacidad no encontrada')
  if (request.status !== 'verified') throw new Error('La solicitud debe estar verificada antes de procesarla')

  const { data: holds, error: holdsError } = await admin
    .from('privacy_legal_holds')
    .select('id')
    .eq('entity_type', request.subject_type)
    .eq('entity_id', request.subject_id)
    .is('released_at', null)
    .limit(1)
  if (holdsError) throw new Error(holdsError.message)
  if (holds && holds.length > 0) {
    const reason = 'Solicitud bloqueada por una retención legal activa'
    await blockRequest(request.id, actor, reason)
    await writeAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: request.subject_type,
      entityId: request.subject_id,
      action: `privacy_${request.request_type}_blocked`,
      metadata: { privacyRequestId: request.id, reason: 'legal_hold' },
      outcome: 'failure',
    })
    return { status: 'blocked' }
  }

  if (request.request_type === 'access') {
    const snapshot = (await loadSubjectSnapshot(
      request.subject_type,
      request.subject_id,
    )) as unknown as Record<string, unknown>
    const { error: updateError } = await admin
      .from('privacy_requests')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
        processed_by: actor.id,
        result_summary: 'Exportación de acceso preparada para entrega segura',
      })
      .eq('id', request.id)
    if (updateError) throw new Error(updateError.message)
    await writeAuditEvent({
      actorId: actor.id,
      actorRole: actor.role,
      entityType: request.subject_type,
      entityId: request.subject_id,
      action: 'privacy_access_completed',
      metadata: { privacyRequestId: request.id },
    })
    return { status: 'completed', data: snapshot }
  }

  if (request.subject_type === 'client') {
    const { data: invoices, error: invoicesError } = await admin
      .from('invoices')
      .select('id')
      .eq('client_id', request.subject_id)
      .limit(1)
    if (invoicesError) throw new Error(invoicesError.message)
    if (invoices && invoices.length > 0) {
      const reason = 'Solicitud bloqueada: el cliente tiene documentos fiscales sujetos a conservación legal'
      await blockRequest(request.id, actor, reason)
      return { status: 'blocked' }
    }
  }

  const patch = anonymizationPatch(request.subject_type)
  if (!patch) {
    const reason = 'La anonimización de personal requiere revisión legal manual'
    await blockRequest(request.id, actor, reason)
    return { status: 'blocked' }
  }
  const { error: anonymizeError } = await admin
    .from(SUBJECT_TABLE[request.subject_type])
    .update(patch)
    .eq('id', request.subject_id)
  if (anonymizeError) throw new Error(anonymizeError.message)

  const { error: completionError } = await admin
    .from('privacy_requests')
    .update({
      status: 'completed',
      processed_at: new Date().toISOString(),
      processed_by: actor.id,
      result_summary: 'Datos personales anonimizados',
    })
    .eq('id', request.id)
  if (completionError) throw new Error(completionError.message)

  await writeAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    entityType: request.subject_type,
    entityId: request.subject_id,
    action: 'privacy_erasure_completed',
    metadata: { privacyRequestId: request.id },
  })
  return { status: 'completed' }
}

export async function withdrawMarketingConsent(
  subjectId: string,
  actor: PrivacyActor,
  source: string,
): Promise<void> {
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin.from('data_processing_consents').insert({
    subject_type: 'lead',
    subject_id: subjectId,
    purpose: 'marketing',
    granted: false,
    withdrawn_at: now,
    source,
    recorded_by: actor.id,
  })
  if (error) throw new Error(error.message)

  const { error: leadError } = await admin
    .from('leads')
    .update({ marketing_consent: false, marketing_consent_withdrawn_at: now })
    .eq('id', subjectId)
  if (leadError) throw new Error(leadError.message)

  await writeAuditEvent({
    actorId: actor.id,
    actorRole: actor.role,
    entityType: 'lead',
    entityId: subjectId,
    action: 'marketing_consent_withdrawn',
    metadata: { source },
  })
}

/** Processes only a bounded due batch; blocked requests retain their reason for review. */
export async function processDuePrivacyErasures(limit = 25): Promise<{
  completed: number
  blocked: number
  failed: number
}> {
  const safeLimit = Math.min(Math.max(limit, 1), 50)
  const { data, error } = await createAdminClient()
    .from('privacy_requests')
    .select('id')
    .eq('request_type', 'erasure')
    .eq('status', 'verified')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(safeLimit)
  if (error) throw new Error(error.message)

  const summary = { completed: 0, blocked: 0, failed: 0 }
  for (const row of data ?? []) {
    try {
      const result = await processPrivacyRequest((row as { id: string }).id, {
      id: null,
        role: 'system',
      })
      summary[result.status] += 1
    } catch {
      summary.failed += 1
    }
  }
  return summary
}