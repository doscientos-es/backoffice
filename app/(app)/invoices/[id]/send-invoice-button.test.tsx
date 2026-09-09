import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  logInvoiceWhatsappShare: vi.fn(),
  previewInvoiceEmail: vi.fn(),
  sendInvoiceEmail: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => actions)
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ isDisabled: _isDisabled, isSelected, onChange, ...props }: { isDisabled?: boolean; isSelected: boolean; onChange: (value: boolean) => void }) => (
    <input {...props} type="checkbox" checked={isSelected} onChange={(event) => onChange(event.target.checked)} />
  ),
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))
vi.mock('@/components/ui/form-feedback', () => ({
  FormFeedback: () => null,
  useFormFeedback: () => ({
    state: { status: 'idle' },
    pending: false,
    setError: vi.fn(),
    setPending: vi.fn(),
    setSuccess: vi.fn(),
  }),
}))
vi.mock('@/components/ui/icon-button', () => ({
  IconButton: ({ children, label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
    <button {...props} aria-label={label}>{children}</button>
  ),
}))
vi.mock('@/components/ui/input', () => ({ Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }))
vi.mock('@/components/ui/label', () => ({ Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }))
vi.mock('@/components/ui/textarea', () => ({ Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} /> }))

import { SendInvoiceButton } from './send-invoice-button'

describe('SendInvoiceButton', () => {
  beforeEach(() => {
    actions.previewInvoiceEmail.mockResolvedValue({
      ok: true,
      subject: 'Tu factura',
      html: '<p>Factura</p>',
      clientEmail: 'cliente@example.test',
      clientPhone: '+34 600 123 456',
      portalUrl: 'https://backoffice.example.test/p/invoice/token',
    })
    actions.logInvoiceWhatsappShare.mockResolvedValue({ ok: true })
    actions.sendInvoiceEmail.mockResolvedValue({ ok: true, mocked: false })
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  it('prefills WhatsApp, includes the portal URL, and logs the share', async () => {
    render(<SendInvoiceButton invoiceId="00000000-0000-0000-0000-000000000001" />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar al cliente' }))
    await waitFor(() =>
      expect((document.getElementById('invoice-whatsapp-phone') as HTMLInputElement).value).toBe(
        '+34 600 123 456',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))

    await waitFor(() => expect(actions.logInvoiceWhatsappShare).toHaveBeenCalled())
    expect(actions.logInvoiceWhatsappShare).toHaveBeenCalledWith({
      id: '00000000-0000-0000-0000-000000000001',
      phone: '+34 600 123 456',
    })
    const url = new URL(vi.mocked(window.open).mock.calls[0]?.[0] as string)
    expect(url.hostname).toBe('wa.me')
    expect(url.pathname).toBe('/34600123456')
    expect(url.searchParams.get('text')).toContain('https://backoffice.example.test/p/invoice/token')
  })

  it('sends the PDF attached by default', async () => {
    render(<SendInvoiceButton invoiceId="00000000-0000-0000-0000-000000000001" />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar al cliente' }))
    await waitFor(() => expect(actions.previewInvoiceEmail).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }))

    await waitFor(() => expect(actions.sendInvoiceEmail).toHaveBeenCalled())
    expect(actions.sendInvoiceEmail).toHaveBeenCalledWith(
      expect.objectContaining({ attachPdf: true, to: 'cliente@example.test' }),
    )
  })
})