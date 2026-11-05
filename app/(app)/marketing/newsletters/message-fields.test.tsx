import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MessageFields } from './message-fields'

describe('editor de email marketing', () => {
  it('inserta variables en el campo seleccionado y actualiza la vista previa', () => {
    render(
      <form>
        <MessageFields id="test" />
      </form>,
    )
    const subject = screen.getByLabelText('Asunto') as HTMLInputElement
    fireEvent.focus(subject)
    fireEvent.change(subject, { target: { value: 'Hola ' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Nombre' }))
    expect(subject.value).toBe('Hola {{nombre}}')
    expect(
      within(screen.getByLabelText('Vista previa de ejemplo')).getByText('Hola Ana'),
    ).toBeTruthy()
    const body = screen.getByLabelText('Mensaje') as HTMLTextAreaElement
    fireEvent.change(body, { target: { value: 'Bienvenida a {{empresa}}' } })
    expect(
      within(screen.getByLabelText('Vista previa de ejemplo')).getByText('Bienvenida a Acme'),
    ).toBeTruthy()
  })
})
