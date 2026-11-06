import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  send: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}))
vi.mock('sileo', () => ({ sileo: state }))
vi.mock('./actions', () => ({
  sendEmailMarketingTest: state.send,
  deleteEmailMarketingStep: vi.fn(),
}))

import { ActionForm } from './action-form'
import { TestEmailButton } from './test-email-button'

beforeEach(() => {
  vi.clearAllMocks()
  state.send.mockResolvedValue({ ok: true, email: 'ana@example.test' })
})

describe('prueba de email', () => {
  it('envía los campos actuales sin guardar ni exigir fecha', async () => {
    const save = vi.fn()
    render(
      <ActionForm action={save} success="Guardado">
        <input name="subject" defaultValue="Hola" />
        <textarea name="bodyMarkdown" defaultValue="Mensaje" />
        <input name="scheduledAt" required />
        <TestEmailButton />
      </ActionForm>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enviar prueba ahora' }))
    await waitFor(() => expect(state.success).toHaveBeenCalled())
    expect(state.send.mock.calls[0]![0].get('bodyMarkdown')).toBe('Mensaje')
    expect(save).not.toHaveBeenCalled()
  })

  it('muestra el fallo parcial y limpia el formulario ya guardado', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, warning: 'Guardado, pero falló la prueba' })
    render(
      <ActionForm action={save} success="Guardado" resetOnSuccess>
        <input name="subject" aria-label="Asunto" />
        <button type="submit">Guardar</button>
      </ActionForm>,
    )
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Hola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(state.warning).toHaveBeenCalled())
    expect((screen.getByLabelText('Asunto') as HTMLInputElement).value).toBe('')
    expect(state.success).not.toHaveBeenCalled()
  })
})
