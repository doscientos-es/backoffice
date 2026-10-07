import { type NextRequest, NextResponse } from 'next/server'

import { requireUser } from '@/lib/auth'
import { scopedLogger } from '@/lib/logger'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const log = scopedLogger('attachments.delete')

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireUser>>
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (user.role === 'viewer') {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params
  const supabase = await createServerClient()
  const { data: attachment, error: fetchError } = await supabase
    .from('attachments')
    .select('id, storage_path')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !attachment) {
    return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })
  }

  const { data: deletedAttachment, error: updateError } = await supabase
    .from('attachments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (updateError) {
    log.error({ attachmentId: id, err: updateError }, 'attachment_soft_delete_failed')
    return NextResponse.json({ error: 'No se pudo eliminar el adjunto' }, { status: 500 })
  }
  if (!deletedAttachment) {
    return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })
  }

  if (attachment.storage_path) {
    const { error: storageError } = await getStorage().remove('documents', [
      attachment.storage_path,
    ])
    if (storageError) {
      log.warn({ attachmentId: id, err: storageError }, 'attachment_storage_cleanup_failed')
    }
  }

  return NextResponse.json({ ok: true })
}
