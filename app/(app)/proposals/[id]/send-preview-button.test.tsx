import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({
  markProposalAsSent: vi.fn(),
  previewProposalEmail: vi.fn(),
  sendPreviewLink: vi.fn(),
}))

import { previewProposalEmail, sendPreviewLink } from '../actions'
import { SendPreviewButton } from './send-preview-button'

const ID = '494d62cb-fd56-4650-b131-9e3a927a20ad'
const loadPreview = vi.mocked(previewProposalEmail)
const send = vi.mocked(sendPreviewLink)

describe('SendPreviewButton', () => {
  beforeEach(() => {
    loadPreview.mockReset()
    send.mockReset()
    loadPreview.mockResolvedValue({
      ok: true,
      subject: 'Propuesta P-2026-0001 · Automatización comercial',
      html: '<html><body>Email de la propuesta</body></html>',
      clientName: 'María López',
      clientPhone: '+34 600 123 456',
      proposalNumber: 'P-2026-0001',
      portalUrl: 'https://app.example.test/p/proposal/token',
    })
    send.mockResolvedValue({
      ok: true,
      portalUrl: 'https://app.example.test/p/proposal/token',
      mocked: false,
    })
  })

  it('prellena el email del lead y muestra el email real antes de enviarlo', async () => {
    render(<SendPreviewButton id={ID} defaultEmail="lead@example.com" alreadySent={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar preview al cliente' }))

    await waitFor(() => expect(loadPreview).toHaveBeenCalledWith({ id: ID, message: undefined }))
    expect((screen.getByLabelText('Email del cliente') as HTMLInputElement).value).toBe(
      'lead@example.com',
    )
    expect((screen.getByLabelText('Teléfono para WhatsApp') as HTMLInputElement).value).toBe(
      '+34 600 123 456',
    )
    expect(screen.getByTitle('Vista previa del email').getAttribute('srcdoc')).toBe(
      '<html><body>Email de la propuesta</body></html>',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }))

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ id: ID, to: 'lead@example.com', message: undefined }),
    )
  })

  it('prepara un mensaje de WhatsApp con el nombre y número de la propuesta', async () => {
    render(<SendPreviewButton id={ID} defaultEmail="lead@example.com" alreadySent={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar preview al cliente' }))
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Compartir por WhatsApp' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    )

    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    fireEvent.click(screen.getByRole('button', { name: 'Compartir por WhatsApp' }))

    const url = new URL(open.mock.calls[0]?.[0] as string)
    expect(url.pathname).toBe('/34600123456')
    expect(url.searchParams.get('text')).toContain(
      'Hola María, te comparto la propuesta P-2026-0001.',
    )
    expect(url.searchParams.get('text')).toContain('https://app.example.test/p/proposal/token')
    open.mockRestore()
  })
})
