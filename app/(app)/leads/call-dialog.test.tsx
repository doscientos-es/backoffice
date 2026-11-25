import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { QCallDialog } from './call-dialog'

const mocks = vi.hoisted(() => ({
  logLeadCall: vi.fn(),
  scheduleLeadMeeting: vi.fn(),
  createReminder: vi.fn(),
  refresh: vi.fn(),
  error: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock('sileo', () => ({ sileo: { error: mocks.error } }))
vi.mock('./actions', () => ({
  logLeadCall: mocks.logLeadCall,
  scheduleLeadMeeting: mocks.scheduleLeadMeeting,
}))
vi.mock('../reminders/actions', () => ({ createReminder: mocks.createReminder }))
vi.mock('./call-digest-dialog', () => ({ CallDigestDialog: () => null }))
vi.mock('./[id]/mom-test-quick-dialog', () => ({ MomTestQuickDialog: () => null }))
vi.mock('./[id]/email-composer', () => ({ EmailComposer: () => null }))
vi.mock('./whatsapp-composer', () => ({ WhatsAppComposer: () => null }))

const leadId = '00000000-0000-4000-8000-000000000001'

function openCallDialog(googleEnabled = true, leadEmail: string | null = 'lead@example.test') {
  render(
    <QCallDialog
      leadId={leadId}
      leadName="Ana"
      leadPhone={null}
      leadEmail={leadEmail}
      senderName="Equipo"
      googleEnabled={googleEnabled}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Registrar llamada' }))
  fireEvent.change(screen.getByPlaceholderText('Puntos clave, próximos pasos…'), {
    target: { value: 'Conversación inicial' },
  })
  fireEvent.click(screen.getByRole('checkbox', { name: /Agendar próxima llamada o videollamada/ }))
  fireEvent.change(screen.getByLabelText('Fecha y hora del próximo seguimiento'), {
    target: { value: '2099-01-02T10:00' },
  })
}

describe('seguimiento al registrar una llamada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.logLeadCall.mockResolvedValue({ ok: true, showMomTestPrompt: false })
    mocks.scheduleLeadMeeting.mockResolvedValue({ ok: true })
    mocks.createReminder.mockResolvedValue({ ok: true })
  })

  afterEach(cleanup)

  it('agenda una llamada telefónica como recordatorio', async () => {
    openCallDialog()
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/ }))
    await waitFor(() =>
      expect(mocks.createReminder).toHaveBeenCalledWith(
        expect.objectContaining({ leadId, actionType: 'call', title: 'Llamar a Ana' }),
      ),
    )
    expect(mocks.scheduleLeadMeeting).not.toHaveBeenCalled()
  })

  it('agenda una reunión Meet con la duración elegida e invita al lead', async () => {
    openCallDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'Videollamada Google Meet' }))
    fireEvent.change(screen.getByLabelText('Duración'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/ }))
    await waitFor(() => expect(mocks.scheduleLeadMeeting).toHaveBeenCalledOnce())
    const input = mocks.scheduleLeadMeeting.mock.calls[0]![0]
    expect(input).toMatchObject({ leadId, attendeeEmails: ['lead@example.test'], withMeet: true })
    expect(new Date(input.end).getTime() - new Date(input.start).getTime()).toBe(30 * 60_000)
    expect(mocks.createReminder).not.toHaveBeenCalled()
  })

  it('avisa cuando falla la agenda sin repetir el registro de la llamada', async () => {
    mocks.scheduleLeadMeeting.mockResolvedValue({ ok: false, error: 'Calendario no disponible' })
    openCallDialog(true, null)
    fireEvent.click(screen.getByRole('radio', { name: 'Videollamada Google Meet' }))
    expect(screen.getByText(/no tiene email registrado/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/ }))
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Calendario no disponible' }),
      ),
    )
    expect(mocks.logLeadCall).toHaveBeenCalledOnce()
    expect(mocks.scheduleLeadMeeting).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeEmails: undefined }),
    )
  })

  it('avisa cuando Calendar creó la reunión pero no se pudo guardar el aviso', async () => {
    mocks.scheduleLeadMeeting.mockResolvedValue({
      ok: true,
      interactionRecorded: true,
      internalReminderCreated: false,
    })
    openCallDialog()
    fireEvent.click(screen.getByRole('radio', { name: 'Videollamada Google Meet' }))
    fireEvent.click(screen.getByRole('button', { name: /^Registrar$/ }))
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringContaining('No vuelvas a crearla') }),
      ),
    )
    expect(mocks.scheduleLeadMeeting).toHaveBeenCalledOnce()
  })

  it('no registra la llamada si el seguimiento tiene una fecha pasada', async () => {
    openCallDialog()
    fireEvent.change(screen.getByLabelText('Fecha y hora del próximo seguimiento'), {
      target: { value: '2000-01-02T10:00' },
    })
    fireEvent.submit(screen.getByRole('button', { name: /^Registrar$/ }).closest('form')!)
    expect(
      screen.getByText('Elige una fecha y hora futuras para el próximo seguimiento.'),
    ).toBeTruthy()
    expect(mocks.logLeadCall).not.toHaveBeenCalled()
  })

  it('deshabilita Meet cuando Google Workspace no está disponible', () => {
    openCallDialog(false)
    expect(
      (screen.getByRole('radio', { name: 'Videollamada Google Meet' }) as HTMLInputElement)
        .disabled,
    ).toBe(true)
    expect(screen.getByText('Google Workspace no está configurado.')).toBeTruthy()
  })
})
