import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTr, type PortalLanguage } from '../_lib/i18n'
import { ProposalWhatsAppWidget } from './whatsapp-widget'

const { trackPortalEngagement } = vi.hoisted(() => ({
  trackPortalEngagement: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../actions', () => ({ trackPortalEngagement }))

beforeEach(() => {
  window.sessionStorage.clear()
  vi.clearAllMocks()
})
afterEach(cleanup)

const baseProps = {
  token: 'example-proposal',
  proposalNumber: 'P-2026-0046 / A&B',
  phone: '15550100000',
  hasMobileCta: true,
}

describe('ProposalWhatsAppWidget', () => {
  it.each<{ language: PortalLanguage; label: string; prompt: string; message: string }>([
    {
      language: 'es',
      label: 'Escríbenos por WhatsApp',
      prompt: '¿Tienes dudas?',
      message: 'Hola, tengo una duda sobre la propuesta',
    },
    {
      language: 'ca',
      label: 'Escriu-nos per WhatsApp',
      prompt: 'Tens dubtes?',
      message: 'Hola, tinc un dubte sobre la proposta',
    },
    {
      language: 'en',
      label: 'Message us on WhatsApp',
      prompt: 'Questions?',
      message: 'Hi, I have a question about proposal',
    },
  ])(
    'opens the company conversation with an encoded proposal reference in $language',
    ({ language, label, prompt, message }) => {
      render(<ProposalWhatsAppWidget {...baseProps} tr={makeTr(language)} />)

      const link = screen.getByRole('link', { name: new RegExp(label) })
      const promptElement = screen.getByText(prompt)
      expect(link.contains(promptElement)).toBe(true)
      expect(link.contains(screen.getByText(label))).toBe(true)
      expect(link.querySelector('svg')).not.toBeNull()
      const url = new URL(link.getAttribute('href')!)
      expect(url.origin).toBe('https://wa.me')
      expect(url.pathname).toBe(`/${baseProps.phone}`)
      expect(url.searchParams.get('text')).toBe(`${message} ${baseProps.proposalNumber}`)
      expect(url.href).not.toContain(baseProps.token)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
      expect(screen.queryByRole('textbox')).toBeNull()
    },
  )

  it('renders only the floating link and reserves space for the mobile action bar when present', () => {
    const { rerender } = render(<ProposalWhatsAppWidget {...baseProps} tr={makeTr('es')} />)
    const link = screen.getByRole('link', { name: /Escríbenos por WhatsApp/ })
    expect(screen.queryByRole('complementary')).toBeNull()
    expect(link.className).toContain('withMobileCta')

    rerender(<ProposalWhatsAppWidget {...baseProps} hasMobileCta={false} tr={makeTr('es')} />)
    expect(link.className).not.toContain('withMobileCta')
  })

  it('tracks a WhatsApp click once per session without sending an internal message', () => {
    render(<ProposalWhatsAppWidget {...baseProps} tr={makeTr('es')} />)
    const link = screen.getByRole('link', { name: /Escríbenos por WhatsApp/ })
    link.addEventListener('click', (event) => event.preventDefault())

    fireEvent.click(link)
    fireEvent.click(link)

    expect(trackPortalEngagement).toHaveBeenCalledExactlyOnceWith(baseProps.token, 'whatsapp_click')
  })
})
