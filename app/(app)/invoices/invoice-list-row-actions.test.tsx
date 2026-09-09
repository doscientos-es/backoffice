import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, PropsWithChildren } from 'react'
import { describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ComponentProps<'button'>) => <button {...props}>{children}</button>,
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: PropsWithChildren) => <>{children}</>,
  DropdownMenuContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: PropsWithChildren<{ onSelect?: () => void }>) => (
    <button type="button" onClick={onSelect}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
}))
vi.mock('./[id]/send-invoice-button', () => ({
  SendInvoiceButton: ({ open }: { open?: boolean }) =>
    open ? <div>Modal de envío de factura</div> : null,
}))

import { InvoiceListRowActions } from './invoice-list-row-actions'

describe('InvoiceListRowActions', () => {
  it('opens the existing client-delivery dialog from the actions menu', () => {
    render(<InvoiceListRowActions invoiceId="invoice-1" canSendToClient />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar o reenviar al cliente' }))

    expect(screen.getByText('Modal de envío de factura')).toBeTruthy()
  })

  it('does not offer client delivery for draft invoices', () => {
    render(<InvoiceListRowActions invoiceId="invoice-1" canSendToClient={false} />)

    expect(screen.queryByRole('button', { name: 'Enviar o reenviar al cliente' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir detalle' }))
    expect(router.push).toHaveBeenCalledWith('/invoices/invoice-1')
  })
})