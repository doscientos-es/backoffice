import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEventInput = {
  actorId?: string | null
  actorRole?: string | null
  entityType: string
  entityId?: string | null
  action: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  origin?: string
  requestId?: string | null
  ip?: string | null
  outcome?: 'success' | 'failure'
}

/**
 * Persists an application-level audit event. Row-change triggers cover ordinary
 * mutations; use this for security-relevant reads and workflow outcomes.
 */
export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const { error } = await createAdminClient()
    .from('audit_events')
    .insert({
      actor_id: input.actorId ?? null,
      actor_role: input.actorRole ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action: input.action,
      before_data: input.beforeData ?? null,
      after_data: input.afterData ?? null,
      metadata: input.metadata ?? {},
      origin: input.origin ?? 'backoffice',
      request_id: input.requestId ?? null,
      ip: input.ip ?? null,
      outcome: input.outcome ?? 'success',
    })

  if (error) throw new Error(`No se pudo registrar la auditoría: ${error.message}`)
}