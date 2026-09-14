'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { InternalDocumentEmail } from '@/components/email'
import { defineAction } from '@/lib/actions/define-action'
import { requireRole, requireUser } from '@/lib/auth'
import { externalAppUrl } from '@/lib/email/app-url'
import { renderEmail } from '@/lib/email/render'
import { sendEmail } from '@/lib/email/resend'
import { isGoogleEnabled, publicEnv, serverEnv } from '@/lib/env'
import { resolveSubject } from '@/lib/google/client'
import { uploadBackup } from '@/lib/google/drive'
import { indexInternalDocument } from '@/lib/internal-documents'
import { scopedLogger } from '@/lib/logger'
import {
  InternalDocDriveBackupInput,
  InternalDocIdInput,
  PreviewInternalDocEmailInput,
  SendInternalDocEmailInput,
  UpdateInternalDocInput,
} from '@/lib/schemas/internal-doc'
import { getStorage } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase/server'

const log = scopedLogger('internal-documents')
const MAX_EMAIL_ATTACHMENT_BYTES = 40 * 1024 * 1024

type InternalDocFile = {
  id: string
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  version: number
  visibility: string
  deleted_at: string | null
}

async function getInternalDocFile(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('internal_documents')
    .select('id, name, storage_path, mime_type, size_bytes, version, visibility, deleted_at')
    .eq('id', id)
    .maybeSingle()
  const doc = data as unknown as InternalDocFile | null
  if (error || !doc || doc.deleted_at) throw new Error('Documento no encontrado')
  if (doc.visibility === 'admins_only' && !['owner', 'admin'].includes(user.role)) {
    throw new Error('Sin permiso')
  }
  return { doc, supabase }
}

function documentEmailHtml(input: {
  documentName: string
  recipientName?: string
  message?: string
}) {
  return renderEmail(
    InternalDocumentEmail({
      ...input,
      appUrl: externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL),
    }),
  )
}

/** Uploads the current file version to its dedicated Drive backup folder. */
export const backupInternalDocToDrive = defineAction<
  typeof InternalDocDriveBackupInput,
  { webViewLink: string | null; version: number }
>({
  name: 'internalDocs.backupToDrive',
  schema: InternalDocDriveBackupInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => [`/internal-docs/${input.id}`],
  handler: async ({ id }, { user }) => {
    if (!isGoogleEnabled()) throw new Error('La integración de Google Drive no está configurada.')
    const folderId = serverEnv().GOOGLE_DRIVE_INTERNAL_DOCS_FOLDER_ID
    if (!folderId) throw new Error('Configura la carpeta de documentos internos de Google Drive.')

    const { doc, supabase } = await getInternalDocFile(id, user)
    const { data, error } = await getStorage().download('internal-docs', doc.storage_path)
    if (error || !data) throw new Error(error ?? 'No se pudo leer el documento')

    const result = await uploadBackup({
      subject: resolveSubject(user.email),
      name: `${doc.name} · v${doc.version}`,
      mimeType: doc.mime_type || 'application/octet-stream',
      data: Buffer.from(data),
      folderId,
    })
    const { error: updateError } = await supabase
      .from('internal_documents')
      .update({
        drive_backup_file_id: result.id,
        drive_backup_url: result.webViewLink,
        drive_backup_version: doc.version,
        drive_backup_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (updateError) throw new Error(updateError.message)

    return { webViewLink: result.webViewLink, version: doc.version }
  },
})

/** Renders the email that will accompany an internal document attachment. */
export const previewInternalDocEmail = defineAction<
  typeof PreviewInternalDocEmailInput,
  { subject: string; html: string }
>({
  name: 'internalDocs.previewEmail',
  schema: PreviewInternalDocEmailInput,
  roles: ['owner', 'admin', 'member'],
  handler: async ({ id, recipientName, subject, message }, { user }) => {
    const { doc } = await getInternalDocFile(id, user)
    return {
      subject,
      html: await documentEmailHtml({ documentName: doc.name, recipientName, message }),
    }
  },
})

/** Sends the current document binary as a personalised email attachment. */
export const sendInternalDocEmail = defineAction<
  typeof SendInternalDocEmailInput,
  { mocked: boolean }
>({
  name: 'internalDocs.sendEmail',
  schema: SendInternalDocEmailInput,
  roles: ['owner', 'admin', 'member'],
  handler: async ({ id, to, recipientName, subject, message }, { user }) => {
    const { doc } = await getInternalDocFile(id, user)
    if (doc.size_bytes && doc.size_bytes > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error('El documento supera el límite de 40 MB para adjuntarlo por email.')
    }
    const { data, error } = await getStorage().download('internal-docs', doc.storage_path)
    if (error || !data) throw new Error(error ?? 'No se pudo leer el documento')
    if (data.byteLength > MAX_EMAIL_ATTACHMENT_BYTES) {
      throw new Error('El documento supera el límite de 40 MB para adjuntarlo por email.')
    }

    const result = await sendEmail({
      fromName: user.name,
      fromAlias: user.emailAlias ?? 'hola',
      replyTo: user.contactEmail ?? user.email,
      to,
      subject,
      html: await documentEmailHtml({ documentName: doc.name, recipientName, message }),
      attachments: [{ filename: doc.name, content: Buffer.from(data) }],
      tags: { internal_document_id: id, kind: 'internal_document' },
    })
    log.info({ documentId: id, mocked: result.mocked }, 'internal_document_email_sent')
    return { mocked: result.mocked }
  },
})

/** Shape of an internal document used when diffing for the audit trail. */
type InternalDocSnapshot = {
  name: string
  description: string | null
  category: string
  visibility: string
  tags: string[] | null
  effective_date: string | null
  expires_at: string | null
}

/** Scalar fields compared field-by-field to build the change log. */
const DIFFED_FIELDS = [
  'name',
  'description',
  'category',
  'visibility',
  'effective_date',
  'expires_at',
] as const

/**
 * Compute the set of changed fields between two snapshots. Tags are compared
 * order-insensitively. Returns `{ field: { from, to } }` for changed fields.
 */
function diffInternalDoc(
  prev: InternalDocSnapshot,
  next: InternalDocSnapshot,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  for (const field of DIFFED_FIELDS) {
    const before = prev[field] ?? null
    const after = next[field] ?? null
    if (before !== after) changes[field] = { from: before, to: after }
  }
  const prevTags = [...(prev.tags ?? [])].sort()
  const nextTags = [...(next.tags ?? [])].sort()
  if (JSON.stringify(prevTags) !== JSON.stringify(nextTags)) {
    changes.tags = { from: prev.tags ?? [], to: next.tags ?? [] }
  }
  return changes
}

/**
 * Update an internal document's metadata (name, description, category,
 * visibility, tags, dates). Editors (owner/admin/member) may edit; only
 * admins may change visibility. Every effective change is recorded in
 * `internal_document_events` for the audit trail.
 */
export const updateInternalDoc = defineAction({
  name: 'internalDocs.update',
  schema: UpdateInternalDocInput,
  roles: ['owner', 'admin', 'member'],
  revalidate: (_payload, input) => ['/internal-docs', `/internal-docs/${input.id}`],
  handler: async (input, { user }) => {
    const supabase = await createServerClient()

    const { data: current, error: fetchError } = await supabase
      .from('internal_documents')
      .select(
        'id, name, description, category, visibility, tags, effective_date, expires_at, deleted_at',
      )
      .eq('id', input.id)
      .maybeSingle()

    if (fetchError || !current || current.deleted_at) {
      throw new Error('Documento no encontrado')
    }

    const prev = current as unknown as InternalDocSnapshot
    const isAdmin = user.role === 'owner' || user.role === 'admin'

    // Changing visibility is an admin-only operation (it can expose or hide
    // documents from the rest of the team).
    if (input.visibility !== prev.visibility && !isAdmin) {
      throw new Error('Solo un administrador puede cambiar la visibilidad.')
    }

    const next: InternalDocSnapshot = {
      name: input.name,
      description: input.description?.trim() || null,
      category: input.category,
      visibility: input.visibility,
      tags: input.tags,
      effective_date: input.effective_date || null,
      expires_at: input.expires_at || null,
    }

    const { error: updateError } = await supabase
      .from('internal_documents')
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq('id', input.id)

    if (updateError) throw new Error(updateError.message)

    const changes = diffInternalDoc(prev, next)
    if (Object.keys(changes).length > 0) {
      await supabase.from('internal_document_events').insert({
        document_id: input.id,
        action: 'updated',
        actor_id: user.id,
        payload: { changes },
      })
    }
  },
})

/** Extract the native PDF text layer for an existing document without changing its file or metadata. */
export async function reindexInternalDoc(formData: FormData): Promise<void> {
  const user = await requireUser()
  if (user.role === 'viewer') throw new Error('Sin permiso')

  const parsed = InternalDocIdInput.safeParse({ id: formData.get('id')?.toString() })
  if (!parsed.success) throw new Error('ID inválido')

  const supabase = await createServerClient()
  const { data: doc, error } = await supabase
    .from('internal_documents')
    .select('id, storage_path, mime_type, version, visibility, deleted_at')
    .eq('id', parsed.data.id)
    .maybeSingle()

  if (error || !doc || doc.deleted_at) throw new Error('Documento no encontrado')
  if ((doc.visibility as string) === 'admins_only' && !['owner', 'admin'].includes(user.role)) {
    throw new Error('Sin permiso')
  }

  const { data, error: downloadError } = await getStorage().download(
    'internal-docs',
    doc.storage_path as string,
  )
  if (downloadError || !data) throw new Error(downloadError ?? 'No se pudo descargar el documento')

  await indexInternalDocument({
    documentId: doc.id as string,
    version: Number(doc.version) || 1,
    mimeType: (doc.mime_type as string | null) ?? null,
    bytes: data,
  })
  revalidatePath(`/internal-docs/${doc.id as string}`)
}

/**
 * Soft-delete an internal document and remove the file from Storage.
 * Only owner/admin can delete.
 */
export async function deleteInternalDoc(formData: FormData): Promise<void> {
  const actor = await requireRole(['owner', 'admin'])

  const parsed = InternalDocIdInput.safeParse({
    id: formData.get('id')?.toString(),
  })
  if (!parsed.success) throw new Error('ID inválido')
  const { id } = parsed.data

  const supabase = await createServerClient()

  // Fetch storage path before deleting
  const { data: doc, error: fetchError } = await supabase
    .from('internal_documents')
    .select('id, name, storage_path, deleted_at')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !doc || doc.deleted_at) {
    throw new Error('Documento no encontrado')
  }

  // Soft delete
  const { error: updateError } = await supabase
    .from('internal_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)

  // Record the deletion in the audit trail before navigating away.
  await supabase.from('internal_document_events').insert({
    document_id: id,
    action: 'deleted',
    actor_id: actor.id,
    payload: { name: doc.name as string },
  })

  // Best-effort: remove file from Storage
  await getStorage().remove('internal-docs', [doc.storage_path as string])

  revalidatePath('/internal-docs')
  redirect('/internal-docs')
}
