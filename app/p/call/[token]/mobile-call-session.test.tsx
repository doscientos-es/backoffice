import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MobileCallSession } from './mobile-call-session'

const fetchMock = vi.fn()
const assignMock = vi.fn()

describe('MobileCallSession', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    assignMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window.location, 'assign').mockImplementation(assignMock)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens the dialer only after recording the attempt', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    render(<MobileCallSession token="token-1" phone="600 111 222" status="started" />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir teléfono' }))

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith('tel:600111222'))
    expect(fetchMock).toHaveBeenCalledWith('/api/public/call-sessions/token-1', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'dial' }),
    }))
  })

  it('keeps the dialer closed and exposes a useful error when the session changed', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'session_changed' }) })
    render(<MobileCallSession token="token-1" phone="600 111 222" status="started" />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir teléfono' }))

    expect((await screen.findByRole('alert')).textContent).toContain('La llamada se actualizó desde otro dispositivo')
    expect(assignMock).not.toHaveBeenCalled()
  })

  it('shows the completion state returned by the server', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, durationMinutes: 3, defaultOutcome: 'connected' }),
    })
    render(<MobileCallSession token="token-1" phone="600 111 222" status="dialing" />)

    fireEvent.click(screen.getByRole('button', { name: 'He terminado' }))

    expect(await screen.findByText('Llamada finalizada')).toBeTruthy()
    expect(screen.getByText(/Duración estimada: 3 min/)).toBeTruthy()
  })
})