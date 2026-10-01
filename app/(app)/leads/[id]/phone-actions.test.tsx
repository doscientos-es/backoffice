import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { toDataURL } from 'qrcode'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getLeadCallSession, startLeadCall } from '../actions'
import { LeadCallLink, LeadWhatsAppButton, PhoneQuickActions } from './phone-actions'

vi.mock('qrcode', () => ({ toDataURL: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/env', () => ({ publicEnv: { NEXT_PUBLIC_CAL_LINK: '' } }))
vi.mock('@/lib/recovery/utils', () => ({ buildBookingUrl: vi.fn(() => null) }))
vi.mock('../actions', () => ({ startLeadCall: vi.fn(), getLeadCallSession: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const props = {
  leadId: 'lead-1',
  leadName: 'María López',
  leadEmail: 'maria@example.com',
  phone: '600 111 222',
  senderName: 'Ana',
}

describe('LeadWhatsAppButton', () => {
  it('keeps the button available after the first contact with a brief greeting', () => {
    render(<LeadWhatsAppButton {...props} firstContactedAt="2026-08-07T10:00:00.000Z" />)

    fireEvent.click(screen.getByRole('button', { name: 'Preparar WhatsApp' }))
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toBe(
      'Hola, María. Soy Ana, de Doscientos.\n\n— Ana',
    )
  })

  it('uses the complete first-contact template before a lead is contacted', () => {
    render(<LeadWhatsAppButton {...props} firstContactedAt={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Preparar WhatsApp' }))
    expect((screen.getByLabelText('Mensaje') as HTMLTextAreaElement).value).toContain(
      'He intentado llamarte porque rellenaste un formulario',
    )
  })
})

describe('PhoneQuickActions', () => {
  it('uses the WhatsApp brand icon next to the lead phone number', () => {
    render(<PhoneQuickActions {...props} />)

    const icon = screen.getByRole('button', { name: 'Preparar WhatsApp' }).querySelector('svg')
    expect(icon?.getAttribute('fill')).toBe('currentColor')
  })
})

describe('LeadCallLink polling', () => {
  it('checks immediately, polls every 15 seconds and stops after completion', async () => {
    vi.useFakeTimers()
    vi.mocked(toDataURL).mockImplementation(() => Promise.resolve('data:image/png;base64,test'))
    vi.mocked(startLeadCall).mockResolvedValue({ ok: true, id: 'call-1', mobileToken: 'token-1' })
    vi.mocked(getLeadCallSession).mockResolvedValue({
      ok: true,
      status: 'dialing',
      durationMinutes: null,
      defaultOutcome: null,
    })
    render(
      <LeadCallLink leadId="lead-1" phone="600111222">
        Llamar
      </LeadCallLink>,
    )
    await act(async () => fireEvent.click(screen.getByText('Llamar')))
    expect(getLeadCallSession).toHaveBeenCalledTimes(1)

    await act(async () => vi.advanceTimersByTimeAsync(14_999))
    expect(getLeadCallSession).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(getLeadCallSession).toHaveBeenCalledTimes(2)

    vi.mocked(getLeadCallSession).mockResolvedValue({
      ok: true,
      status: 'awaiting_log',
      durationMinutes: 2,
      defaultOutcome: 'connected',
    })
    await act(async () => vi.advanceTimersByTimeAsync(15_000))
    expect(getLeadCallSession).toHaveBeenCalledTimes(3)
    await act(async () => vi.advanceTimersByTimeAsync(30_000))
    expect(getLeadCallSession).toHaveBeenCalledTimes(3)
  })
})
