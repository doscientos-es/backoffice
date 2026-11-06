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
    const frame = screen.getByTitle('Contenido del email de ejemplo') as HTMLIFrameElement
    expect(frame.srcdoc).toContain('Bienvenida a Acme')
    expect(frame.srcdoc).toContain('Dejar de recibir correos')
    expect(frame.srcdoc).toContain('Política de privacidad')
  })

  it('renderiza el mismo Markdown que el envío en una vista previa aislada', () => {
    render(<MessageFields id="test" />)
    fireEvent.change(screen.getByLabelText('Mensaje'), {
      target: { value: 'Hola **{{nombre}}**\n[Enlace](https://example.test)\n*Texto*' },
    })
    const frame = screen.getByTitle('Contenido del email de ejemplo') as HTMLIFrameElement
    expect(frame.srcdoc).toContain('<strong>Ana</strong>')
    expect(frame.srcdoc).toContain('<br>')
    expect(frame.srcdoc).toContain('<a href="https://example.test">Enlace</a>')
    expect(frame.srcdoc).toContain('<em>Texto</em>')
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.srcdoc).toContain("default-src 'none'")
  })
})
