import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AttachmentSection } from '@/components/ui/attachment-section'

// ── router stub ──────────────────────────────────────────────────────────────
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

vi.mock('next/link', () => ({
  default: (props: React.ComponentPropsWithoutRef<'a'>) => <a {...props} />,
}))

const mockConfirm = vi.fn(() => true)

// ── helpers ──────────────────────────────────────────────────────────────────
function makeFile(name: string, type = 'application/pdf') {
  return new File(['x'], name, { type })
}

const BASE_PROPS = {
  entityType: 'lead' as const,
  entityId: 'lead-1',
  attachments: [],
  canEdit: true,
}

// ── setup / teardown ─────────────────────────────────────────────────────────
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('confirm', mockConfirm)
  mockRefresh.mockClear()
  mockConfirm.mockClear()
  mockConfirm.mockReturnValue(true)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ── read-only mode ────────────────────────────────────────────────────────────
describe('read-only mode (canEdit=false)', () => {
  it('hides the file button and upload input', () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /añadir/i })).toBeNull()
    expect(document.querySelector('input[type=file]')).toBeNull()
  })

  it("shows 'Sin adjuntos.' without the drag hint", () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />)
    expect(screen.getByText('Sin adjuntos.')).toBeDefined()
  })
})

// ── empty-state hint ─────────────────────────────────────────────────────────
describe('empty state with canEdit', () => {
  it('shows drag hint text', () => {
    render(<AttachmentSection {...BASE_PROPS} />)
    expect(screen.getByText(/arrastra archivos/i)).toBeDefined()
  })

  it('offers the device camera for mobile attachments', () => {
    render(<AttachmentSection {...BASE_PROPS} />)

    expect(screen.getByRole('button', { name: /hacer foto/i })).toBeDefined()
    expect(document.querySelector('input[capture="environment"]')).toBeDefined()
  })
})

// ── attachment list ───────────────────────────────────────────────────────────
describe('attachment list', () => {
  const item = {
    id: 'a1',
    name: 'report.pdf',
    mime_type: 'application/pdf',
    size_bytes: 2048,
    created_at: '2024-01-01',
  }
  const items = [item]

  it('renders attachment names with download links', () => {
    render(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    expect(screen.getByText('report.pdf')).toBeDefined()
    expect(screen.getByRole('link', { name: /ver report.pdf/i }).getAttribute('href')).toBe(
      '/api/documents/a1/view',
    )
    const link = screen.getByRole('link', { name: /descargar report.pdf/i })
    expect(link.getAttribute('href')).toBe('/api/documents/a1/download')
    expect(link.getAttribute('target')).toBeNull()
  })

  it('offers a separate preview for images and no preview for unsupported files', () => {
    render(
      <AttachmentSection
        {...BASE_PROPS}
        attachments={[
          { ...item, id: 'image', name: 'foto.jpg', mime_type: 'image/jpeg' },
          { ...item, id: 'sheet', name: 'datos.xlsx', mime_type: 'application/vnd.ms-excel' },
        ]}
      />,
    )
    const preview = screen.getByRole('link', { name: /ver foto.jpg/i })
    expect(preview.getAttribute('href')).toBe('/api/documents/image/view')
    expect(preview.getAttribute('target')).toBe('_blank')
    expect(screen.queryByRole('link', { name: /ver datos.xlsx/i })).toBeNull()
  })

  it('downloads a ZIP containing stored attachments for read-only users and explains Drive exclusions', async () => {
    const drive = {
      ...item,
      id: 'drive',
      source: 'drive' as const,
      web_view_link: 'https://drive.google.com/file/d/example/view',
    }
    const createObjectURL = vi.fn(() => 'blob:zip')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['zip']),
    })

    render(<AttachmentSection {...BASE_PROPS} canEdit={false} attachments={[item, drive]} />)
    fireEvent.click(screen.getByRole('button', { name: /descargar todos los adjuntos/i }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      '/api/attachments/download-all',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ids: ['a1'] }),
      }),
    )
    expect(screen.getByText(/enlaces de google drive no se incluyen/i)).toBeDefined()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:zip')
    click.mockRestore()
  })

  it('reports failures when preparing the ZIP', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Descarga no disponible' }),
    })
    render(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    fireEvent.click(screen.getByRole('button', { name: /descargar todos los adjuntos/i }))
    await waitFor(() => expect(screen.getByText('Descarga no disponible')).toBeDefined())
  })

  it('confirms and removes an attachment, then refreshes the detail page', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })

    render(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    fireEvent.click(screen.getByRole('button', { name: /eliminar adjunto report.pdf/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
    expect(mockConfirm).toHaveBeenCalledWith('¿Quitar «report.pdf» de este registro?')
    expect(fetch).toHaveBeenCalledWith('/api/attachments/a1', { method: 'DELETE' })
    expect(screen.queryByText('report.pdf')).toBeNull()
  })

  it('hides a single attachment immediately and restores it on failure', async () => {
    let finishDelete!: (response: { ok: boolean; json: () => Promise<{ error: string }> }) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        finishDelete = resolve
      }),
    )
    render(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    fireEvent.click(screen.getByRole('button', { name: /eliminar adjunto report.pdf/i }))
    expect(screen.queryByText('report.pdf')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Eliminando adjunto')

    finishDelete({ ok: false, json: async () => ({ error: 'Sin permiso' }) })
    expect(await screen.findByText('Sin permiso')).toBeDefined()
    expect(screen.getByText('report.pdf')).toBeDefined()
  })

  it('keeps a successful removal hidden until the server confirms it, then accepts later changes', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const { rerender } = render(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    fireEvent.click(screen.getByRole('button', { name: /eliminar adjunto report.pdf/i }))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())

    rerender(<AttachmentSection {...BASE_PROPS} attachments={[...items]} />)
    expect(screen.queryByText('report.pdf')).toBeNull()
    rerender(<AttachmentSection {...BASE_PROPS} attachments={[]} />)
    rerender(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    expect(screen.getByText('report.pdf')).toBeDefined()
  })

  it('does not call the delete endpoint when the user cancels', () => {
    mockConfirm.mockReturnValue(false)
    render(<AttachmentSection {...BASE_PROPS} attachments={items} />)
    fireEvent.click(screen.getByRole('button', { name: /eliminar adjunto report.pdf/i }))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('only offers bulk deletion to editors with attachments', () => {
    const { rerender } = render(<AttachmentSection {...BASE_PROPS} />)
    expect(screen.queryByRole('button', { name: 'Más acciones de adjuntos' })).toBeNull()
    rerender(<AttachmentSection {...BASE_PROPS} canEdit={false} attachments={items} />)
    expect(screen.queryByRole('button', { name: 'Más acciones de adjuntos' })).toBeNull()
  })

  it('asks for confirmation and does not delete when cancelled', async () => {
    const drive = { ...item, id: 'drive', name: 'Drive', source: 'drive' as const }
    render(<AttachmentSection {...BASE_PROPS} attachments={[item, drive]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de adjuntos' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar todos los adjuntos' }))
    expect(screen.getByRole('alertdialog', { name: '¿Eliminar todos los adjuntos?' })).toBeDefined()
    expect(screen.getByText(/adjuntos compartidos entre la oportunidad y el cliente/)).toBeDefined()
    expect(screen.getByText(/archivos originales de Google Drive no se eliminarán/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(fetch).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('deletes each confirmed attachment and refreshes once', async () => {
    const drive = { ...item, id: 'drive', name: 'Drive', source: 'drive' as const }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const { rerender } = render(<AttachmentSection {...BASE_PROPS} attachments={[item, drive]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de adjuntos' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar todos los adjuntos' }))
    rerender(
      <AttachmentSection
        {...BASE_PROPS}
        attachments={[item, drive, { ...item, id: 'new', name: 'new.pdf' }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar todos' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/attachments/a1', { method: 'DELETE' })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/attachments/drive', { method: 'DELETE' })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('report.pdf')).toBeNull()
    expect(screen.queryByText('Drive')).toBeNull()
    expect(screen.getByText('new.pdf')).toBeDefined()
  })

  it('hides all confirmed attachments immediately while deletion is in progress', async () => {
    let finishDelete!: (response: { ok: boolean }) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((resolve) => {
        finishDelete = resolve
      }),
    )
    render(<AttachmentSection {...BASE_PROPS} attachments={items} />)

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de adjuntos' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar todos los adjuntos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar todos' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.queryByText('report.pdf')).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Eliminando adjuntos')
    expect(screen.queryByRole('button', { name: 'Más acciones de adjuntos' })).toBeNull()
    expect(fetch).toHaveBeenCalledOnce()
    finishDelete({ ok: true })
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
  })

  it('continues after a failure and reports which attachment could not be deleted', async () => {
    const second = { ...item, id: 'a2', name: 'second.pdf' }
    ;(fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Sin permiso' }) })
      .mockResolvedValueOnce({ ok: true })
    render(<AttachmentSection {...BASE_PROPS} attachments={[item, second]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones de adjuntos' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Eliminar todos los adjuntos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar todos' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(screen.getByText('report.pdf: Sin permiso')).toBeDefined()
    expect(screen.getByText('report.pdf')).toBeDefined()
    expect(screen.queryByText('second.pdf')).toBeNull()
  })

  it('renders drive attachments with an external link to web_view_link', () => {
    const driveItems = [
      {
        id: 'd1',
        name: 'Requisitos técnicos',
        mime_type: 'application/vnd.google-apps.document',
        size_bytes: null,
        created_at: '2024-01-01',
        source: 'drive' as const,
        web_view_link: 'https://docs.google.com/document/d/abc123/edit',
      },
    ]
    render(<AttachmentSection {...BASE_PROPS} attachments={driveItems} />)
    expect(screen.getByText('Requisitos técnicos')).toBeDefined()
    const link = screen.getByRole('link', { name: /abrir en drive/i })
    expect(link.getAttribute('href')).toBe('https://docs.google.com/document/d/abc123/edit')
    expect(screen.queryByRole('link', { name: /descargar/i })).toBeNull()
  })
})

// ── drive linking ─────────────────────────────────────────────────────────────
describe('drive linking', () => {
  it("hides the 'Vincular desde Google Drive' button when canEdit is false", () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /vincular desde google drive/i })).toBeNull()
  })

  it("opens the dialog when clicking 'Vincular desde Google Drive'", () => {
    render(<AttachmentSection {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /vincular desde google drive/i }))
    expect(screen.getByText('Vincular documento de Drive')).toBeDefined()
    expect(screen.getByLabelText(/enlace de drive/i)).toBeDefined()
  })

  it('submits the drive URL and refreshes on success', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-drive-id' }),
    })

    render(<AttachmentSection {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /vincular desde google drive/i }))

    const input = screen.getByLabelText(/enlace de drive/i)
    fireEvent.change(input, {
      target: { value: 'https://docs.google.com/document/d/abc123/edit' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^vincular$/i }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledWith(
      '/api/attachments/drive-link',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          drive_url: 'https://docs.google.com/document/d/abc123/edit',
          entityType: 'lead',
          entityId: 'lead-1',
        }),
      }),
    )
    expect(screen.queryByText('Vincular documento de Drive')).toBeNull()
  })

  it('shows an error message when linking fails', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No se pudo acceder al documento' }),
    })

    render(<AttachmentSection {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /vincular desde google drive/i }))

    const input = screen.getByLabelText(/enlace de drive/i)
    fireEvent.change(input, {
      target: { value: 'https://docs.google.com/document/d/abc123/edit' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^vincular$/i }))

    await waitFor(() => screen.getByText('No se pudo acceder al documento'))
    expect(mockRefresh).not.toHaveBeenCalled()
    // dialog stays open so the user can fix the link
    expect(screen.getByText('Vincular documento de Drive')).toBeDefined()
  })

  it("shows 'Error de red' on network failure", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))

    render(<AttachmentSection {...BASE_PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: /vincular desde google drive/i }))

    const input = screen.getByLabelText(/enlace de drive/i)
    fireEvent.change(input, {
      target: { value: 'https://docs.google.com/document/d/abc123/edit' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^vincular$/i }))

    await waitFor(() => screen.getByText('Error de red'))
  })
})

// ── helper: simulate file input change ───────────────────────────────────────
function simulateFileInput(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    value: files,
    writable: false,
    configurable: true,
  })
  fireEvent.change(input)
}

// ── button-triggered upload ───────────────────────────────────────────────────
describe('button upload', () => {
  it('calls /api/attachments/upload and refreshes on success', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'new-id' }),
    })

    render(<AttachmentSection {...BASE_PROPS} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    simulateFileInput(input, [makeFile('doc.pdf')])

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('displays per-file error when upload fails', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Tipo no permitido' }),
    })

    render(<AttachmentSection {...BASE_PROPS} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    simulateFileInput(input, [makeFile('bad.exe', 'application/x-msdownload')])

    await waitFor(() => screen.getByText(/Tipo no permitido/))
    expect(screen.getByText(/bad\.exe/)).toBeDefined()
  })

  it('uploads multiple files sequentially and collects partial errors', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'id-1' }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Demasiado grande' }) })

    render(<AttachmentSection {...BASE_PROPS} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    simulateFileInput(input, [makeFile('a.pdf'), makeFile('b.pdf')])

    await waitFor(() => screen.getByText(/Demasiado grande/))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // first file succeeded — no error for it
    expect(screen.queryByText(/a\.pdf/)).toBeNull()
    // second file failed — error present
    expect(screen.getByText(/b\.pdf/)).toBeDefined()
    expect(mockRefresh).toHaveBeenCalledOnce()
  })

  it("shows 'Error de red' on network failure", async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))

    render(<AttachmentSection {...BASE_PROPS} />)
    const input = document.querySelector('input[type=file]') as HTMLInputElement
    simulateFileInput(input, [makeFile('doc.pdf')])

    await waitFor(() => screen.getByText(/Error de red/))
  })
})

// ── drag-and-drop ─────────────────────────────────────────────────────────────
describe('drag-and-drop', () => {
  it('shows overlay on dragenter and hides on dragleave', () => {
    render(<AttachmentSection {...BASE_PROPS} />)
    const card =
      document.querySelector('[data-slot=card]') ?? screen.getByText('Adjuntos').closest('[class]')!

    fireEvent.dragEnter(card, { dataTransfer: { files: [] } })
    expect(screen.getByText(/suelta los archivos/i)).toBeDefined()

    fireEvent.dragLeave(card)
    expect(screen.queryByText(/suelta los archivos/i)).toBeNull()
  })

  it('uploads dropped files', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'dropped-id' }),
    })

    render(<AttachmentSection {...BASE_PROPS} />)
    const card =
      document.querySelector('[data-slot=card]') ?? screen.getByText('Adjuntos').closest('[class]')!

    const file = makeFile('dropped.pdf')
    fireEvent.drop(card, { dataTransfer: { files: [file] } })

    await waitFor(() => expect(mockRefresh).toHaveBeenCalledOnce())
  })

  it('ignores drag events when canEdit is false', () => {
    render(<AttachmentSection {...BASE_PROPS} canEdit={false} />)
    const card =
      document.querySelector('[data-slot=card]') ??
      screen.getByText('Sin adjuntos.').closest('[class]')!
    fireEvent.dragEnter(card)
    expect(screen.queryByText(/suelta los archivos/i)).toBeNull()
  })
})
