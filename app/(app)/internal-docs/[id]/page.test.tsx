import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

type ChildrenProps = { children: ReactNode }

const mocks = vi.hoisted(() => ({
  documentResult: {
    data: {
      id: 'doc-1',
      name: 'Documento de prueba',
      description: null,
      category: 'other',
      tags: [],
      mime_type: 'application/pdf',
      size_bytes: 123,
      storage_path: 'other/doc-1/documento.pdf',
      version: 1,
      visibility: 'all_team',
      effective_date: null,
      expires_at: null,
      created_at: '2026-09-08T12:00:00.000Z',
      uploaded_by: 'member-1',
      deleted_at: null,
      team_members: { name: 'Persona de prueba' },
    },
    error: null as { code?: string } | null,
  },
  eventsResult: { data: null as unknown[] | null, error: null as { code?: string } | null },
  extractionResult: { data: null as unknown, error: null as { code?: string } | null },
  extractionRejects: false,
  getInternalDocPreviewUrl: vi.fn(),
  log: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('not found') }) }))
vi.mock('@/lib/auth', () => ({ requireUser: vi.fn(async () => ({ role: 'viewer' })) }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => mocks.log }))
vi.mock('@/lib/internal-documents/preview', () => ({
  getInternalDocPreviewUrl: mocks.getInternalDocPreviewUrl,
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => {
        if (table === 'internal_documents') {
          return { eq: () => ({ is: () => ({ maybeSingle: () => Promise.resolve(mocks.documentResult) }) }) }
        }
        if (table === 'internal_document_events') {
          return {
            eq: () => ({ order: () => ({ limit: () => Promise.resolve(mocks.eventsResult) }) }),
          }
        }
        return {
          eq: () => ({
            maybeSingle: () =>
              mocks.extractionRejects
                ? Promise.reject(new TypeError('network error'))
                : Promise.resolve(mocks.extractionResult),
          }),
        }
      },
    }),
  })),
}))

vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}))
vi.mock('@/components/layout/detail-grid', () => ({
  DetailGrid: ({ children }: ChildrenProps) => <dl>{children}</dl>,
  DetailRow: ({ children, label }: ChildrenProps & { label: string }) => (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  ),
}))
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: ChildrenProps) => <span>{children}</span> }))
vi.mock('@/components/ui/button', () => ({
  Button: ({ asChild, children }: ChildrenProps & { asChild?: boolean }) =>
    asChild ? children : <button type="button">{children}</button>,
}))
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: ChildrenProps) => <section>{children}</section>,
  CardContent: ({ children }: ChildrenProps) => <div>{children}</div>,
  CardHeader: ({ children }: ChildrenProps) => <header>{children}</header>,
  CardTitle: ({ children }: ChildrenProps) => <h2>{children}</h2>,
}))
vi.mock('@/components/ui/danger-zone', () => ({ DangerZone: ({ children }: ChildrenProps) => <div>{children}</div> }))
vi.mock('@/components/ui/submit-button', () => ({
  SubmitButton: ({ children }: ChildrenProps) => <button type="submit">{children}</button>,
}))
vi.mock('@doscientos/ui', () => ({ DocPreview: () => <p>Preview no disponible</p> }))
vi.mock('./internal-doc-edit-dialog', () => ({ InternalDocEditDialog: () => <button type="button">Editar</button> }))
vi.mock('./internal-doc-history', () => ({ InternalDocHistory: () => <p>Sin actividad registrada todavía.</p> }))
vi.mock('../actions', () => ({ deleteInternalDoc: vi.fn(), reindexInternalDoc: vi.fn() }))

import InternalDocDetailPage from './page'

describe('InternalDocDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eventsResult = { data: null, error: null }
    mocks.extractionResult = { data: null, error: null }
    mocks.extractionRejects = false
    mocks.getInternalDocPreviewUrl.mockResolvedValue(null)
  })

  it('renders the document when preview and optional data fail', async () => {
    mocks.eventsResult = { data: null, error: { code: 'PGRST205' } }
    mocks.extractionRejects = true

    render(await InternalDocDetailPage({ params: Promise.resolve({ id: 'doc-1' }) }))

    expect(screen.getByRole('heading', { name: 'Documento de prueba' })).toBeTruthy()
    expect(screen.getByText('Preview no disponible')).toBeTruthy()
    expect(mocks.getInternalDocPreviewUrl).toHaveBeenCalledWith('doc-1', 'other/doc-1/documento.pdf')
    expect(mocks.log.warn).toHaveBeenCalledWith(
      { documentId: 'doc-1', source: 'events', errorCode: 'PGRST205' },
      'could not load optional internal document data',
    )
  })
})