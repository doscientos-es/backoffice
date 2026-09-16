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

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 422,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  }
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
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'attachment-1' }))
      .mockRejectedValueOnce(new Error('Servicio de extracción no disponible'))

    render(
      <ExpenseInvoiceUpload
        onAttached={onAttached}
        onExtracted={onExtracted}
        onPendingChange={onPendingChange}
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
})
