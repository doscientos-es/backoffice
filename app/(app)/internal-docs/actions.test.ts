import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const state = {
    doc: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Política de privacidad.pdf',
      storage_path: 'policies/doc-1/file.pdf',
      mime_type: 'application/pdf',
      size_bytes: 4,
      version: 2,
      visibility: 'all_team',
      deleted_at: null,
    },
    update: null as Record<string, unknown> | null,
  }
  return {
    state,
    download: vi.fn(),
    renderEmail: vi.fn(),
    sendEmail: vi.fn(),
    uploadBackup: vi.fn(),
  }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(async () => ({
    id: 'member-1',
    role: 'member',
    name: 'Marta',
    email: 'marta@doscientos.es',
    emailAlias: null,
    contactEmail: null,
  })),
  requireUser: vi.fn(),
}))
vi.mock('@/lib/env', () => ({
  isGoogleEnabled: () => true,
  publicEnv: { NEXT_PUBLIC_APP_URL: 'https://app.example.test' },
  serverEnv: () => ({ GOOGLE_DRIVE_INTERNAL_DOCS_FOLDER_ID: 'internal-docs-folder' }),
}))
vi.mock('@/lib/google/client', () => ({ resolveSubject: () => 'marta@doscientos.es' }))
vi.mock('@/lib/google/drive', () => ({ uploadBackup: mocks.uploadBackup }))
vi.mock('@/lib/internal-documents', () => ({ indexInternalDocument: vi.fn() }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/email/app-url', () => ({ externalAppUrl: (url: string) => url }))
vi.mock('@/lib/email/render', () => ({ renderEmail: mocks.renderEmail }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/storage', () => ({ getStorage: () => ({ download: mocks.download }) }))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mocks.state.doc, error: null }) }),
      }),
      update: (values: Record<string, unknown>) => {
        mocks.state.update = values
        return { eq: async () => ({ error: null }) }
      },
    }),
  })),
}))

import { backupInternalDocToDrive, sendInternalDocEmail } from './actions'

describe('internal document delivery actions', () => {
  beforeEach(() => {
    mocks.state.update = null
    mocks.download.mockResolvedValue({ data: new Uint8Array([1, 2, 3, 4]).buffer, error: null })
    mocks.renderEmail.mockResolvedValue('<p>Documento</p>')
    mocks.sendEmail.mockResolvedValue({ id: 'email-1', mocked: false })
    mocks.uploadBackup.mockResolvedValue({
      id: 'drive-1',
      webViewLink: 'https://drive.example/file',
    })
  })

  it('backs up the active file version and records its Drive reference', async () => {
    await expect(backupInternalDocToDrive({ id: mocks.state.doc.id })).resolves.toMatchObject({
      ok: true,
      version: 2,
      webViewLink: 'https://drive.example/file',
    })

    expect(mocks.uploadBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Política de privacidad.pdf · v2',
        folderId: 'internal-docs-folder',
      }),
    )
    expect(mocks.state.update).toMatchObject({
      drive_backup_file_id: 'drive-1',
      drive_backup_url: 'https://drive.example/file',
      drive_backup_version: 2,
    })
  })

  it('emails the active document as an attachment', async () => {
    await expect(
      sendInternalDocEmail({
        id: mocks.state.doc.id,
        to: 'ana@example.com',
        recipientName: 'Ana',
        subject: 'Política de privacidad',
        message: 'Para tu revisión.',
      }),
    ).resolves.toMatchObject({ ok: true, mocked: false })

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@example.com',
        subject: 'Política de privacidad',
        fromName: 'Backoffice doscientos',
        fromAlias: 'backoffice',
        replyTo: 'backoffice@doscientos.es',
        attachments: [expect.objectContaining({ filename: 'Política de privacidad.pdf' })],
      }),
    )
  })
})
