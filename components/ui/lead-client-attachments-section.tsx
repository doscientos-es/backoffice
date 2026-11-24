import { type AttachmentItem, AttachmentSection } from '@/components/ui/attachment-section'
import { createServerClient } from '@/lib/supabase/server'

/** Shows one shared list without copying attachments between related entities. */
export async function LeadClientAttachmentsSection({
  leadId,
  clientId,
  entityType,
  canEdit,
}: {
  leadId: string | null
  clientId: string | null
  entityType: 'lead' | 'client'
  canEdit: boolean
}) {
  const entityId = entityType === 'lead' ? leadId : clientId
  if (!entityId) throw new Error('Falta la entidad para los adjuntos')

  const supabase = await createServerClient()
  const query = supabase
    .from('attachments')
    .select('id, name, mime_type, size_bytes, created_at, source, web_view_link')
    .is('deleted_at', null)
  const scoped =
    leadId && clientId
      ? query.or(`lead_id.eq.${leadId},client_id.eq.${clientId}`)
      : query.eq(entityType === 'lead' ? 'lead_id' : 'client_id', entityId)
  const { data, error } = await scoped.order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (
    <AttachmentSection
      entityType={entityType}
      entityId={entityId}
      attachments={(data ?? []) as AttachmentItem[]}
      canEdit={canEdit}
    />
  )
}
