import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const send = vi.hoisted(() => vi.fn(async () => ({ ok: true, outcome: 'started' })))
vi.mock('./actions', () => ({ sendEmailMarketingStepNow: send }))
vi.mock('sileo', () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

import { SendNowDialog } from './send-now-dialog'

describe('enviar ahora', () => {
  it('solicita confirmación antes de iniciar el envío seleccionado', async () => {
    render(
      <SendNowDialog
        id="step-1"
        title="Bienvenida"
        listName="Clientes"
        count={4}
        active
        configured
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ahora' }))
    expect(send).not.toHaveBeenCalled()
    expect(screen.getByText(/actualmente 4/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envío' }))
    await waitFor(() => expect(send).toHaveBeenCalledWith({ id: 'step-1', confirm: true }))
  })

  it('impide el envío desde una secuencia pausada', () => {
    render(
      <SendNowDialog
        id="step-2"
        title="Correo"
        listName="Clientes"
        count={4}
        active={false}
        configured
      />,
    )
    expect(
      (screen.getByRole('button', { name: 'Enviar ahora' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})
