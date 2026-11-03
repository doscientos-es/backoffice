import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExpenseInvoiceUpload } from './expense-invoice-upload'

vi.mock('@doscientos/ui', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

const fetchMock = vi.fn()

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 422) {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  }
}

async function openAnalysisReview(details: { size_bytes?: number; page_count?: number | null }) {
  const callbacks = {
    onAttached: vi.fn(),
    onExtracted: vi.fn(),
    onPendingChange: vi.fn(),
    onReviewChange: vi.fn(),
  }
  fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'attachment-1' })).mockResolvedValueOnce(
    jsonResponse(
      {
        requires_confirmation: true,
        reason: 'No se pudo leer el texto del PDF ni comprobar cuántas páginas tiene.',
        ...details,
      },
      false,
      409,
    ),
  )
  render(<ExpenseInvoiceUpload {...callbacks} />)
  fireEvent.change(screen.getByLabelText('Factura en PDF o foto'), {
    target: { files: [new File(['pdf'], 'factura.pdf')] },
  })
  await screen.findByRole('heading', { name: 'Confirmar análisis con IA' })
  return callbacks
}

describe('ExpenseInvoiceUpload', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('closes the scan dialog and keeps the attachment when extraction fails', async () => {
    const onAttached = vi.fn()
    const onExtracted = vi.fn()
    const onPendingChange = vi.fn()
    const onReviewChange = vi.fn()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'attachment-1' }))
      .mockRejectedValueOnce(new Error('Servicio de extracción no disponible'))

    render(
      <ExpenseInvoiceUpload
        onAttached={onAttached}
        onExtracted={onExtracted}
        onPendingChange={onPendingChange}
        onReviewChange={onReviewChange}
      />,
    )

    const input = screen.getByLabelText('Factura en PDF o foto')
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'factura.pdf')] } })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Servicio de extracción no disponible')).toBeDefined()
    expect(screen.getByText(/PDF quedará adjunto/)).toBeDefined()
    expect(onAttached).toHaveBeenLastCalledWith({ id: 'attachment-1', name: 'factura.pdf' })
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
  })

  it.each([
    [512, '512 B'],
    [32 * 1024, '32 KB'],
    [9 * 1024 * 1024, '9 MB'],
    [1.5 * 1024 * 1024, '1,5 MB'],
    [undefined, 'Tamaño no disponible'],
    [0, 'Tamaño no disponible'],
  ] as const)(
    'shows %s bytes as %s without claiming the file is expensive',
    async (bytes, label) => {
      await openAnalysisReview({ size_bytes: bytes })

      expect(screen.getByText(label)).toBeDefined()
      expect(screen.getByText(/No se pudo leer el texto del PDF/)).toBeDefined()
      expect(screen.queryByText(/análisis costoso|0[,.]0 MB/i)).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    },
  )

  it('keeps known page counts alongside the file size', async () => {
    await openAnalysisReview({ size_bytes: 9 * 1024 * 1024, page_count: 14 })

    expect(screen.getByText('14 páginas · 9 MB')).toBeDefined()
  })

  it('keeps the invoice attached without another AI request when choosing manual entry', async () => {
    const { onAttached, onPendingChange } = await openAnalysisReview({ size_bytes: 32 * 1024 })

    fireEvent.click(screen.getByRole('button', { name: 'Rellenar a mano' }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onAttached).toHaveBeenLastCalledWith({ id: 'attachment-1', name: 'factura.pdf' })
    expect(onPendingChange).toHaveBeenLastCalledWith(false)
  })

  it('retries with explicit consent and only imports the result after acceptance', async () => {
    const { onExtracted, onPendingChange } = await openAnalysisReview({ size_bytes: 32 * 1024 })
    const suggestion = {
      vendor: 'Proveedor de prueba',
      description: null,
      expense_date: null,
      due_date: null,
      subtotal: 100,
      tax_rate: 21,
      total: 121,
      vendor_nif: null,
      invoice_reference: null,
      confidence: 0.9,
    }
    fetchMock.mockResolvedValueOnce(jsonResponse({ suggestion, source: 'ai', warning: null }))

    fireEvent.click(screen.getByRole('button', { name: 'Analizar con IA' }))
    await screen.findByRole('heading', { name: 'Factura analizada' })

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/expenses/extract-invoice',
      expect.objectContaining({
        body: JSON.stringify({ attachment_id: 'attachment-1', confirm_large: true }),
      }),
    )
    expect(onExtracted).not.toHaveBeenCalled()
    expect(onPendingChange).toHaveBeenLastCalledWith(false)

    fireEvent.click(screen.getByRole('button', { name: 'Importar datos' }))
    expect(onExtracted).toHaveBeenCalledWith(suggestion, { source: 'ai', warning: null })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
