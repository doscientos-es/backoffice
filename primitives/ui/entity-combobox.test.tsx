import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { EntityCombobox } from './entity-combobox'

const items = [
  { id: 'ana', label: 'Ana', sublabel: 'Doscientos' },
  { id: 'bea', label: 'Bea', sublabel: 'Otra empresa' },
]

describe('EntityCombobox', () => {
  it('searches by company and selects the entity ID', async () => {
    const onChange = vi.fn()
    render(<EntityCombobox items={items} value="" onChange={onChange} aria-label="Cliente" />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.change(input, { target: { value: 'Doscientos' } })
    await waitFor(() => expect(screen.getByRole('option', { name: /Ana/ })).toBeDefined())
    expect(screen.queryByRole('option', { name: /Bea/ })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: /Ana/ }))
    expect(onChange).toHaveBeenCalledWith('ana')
  })
  it('submits the selected ID and clears it through the standard control', async () => {
    function Form() {
      const [value, setValue] = useState('ana')
      return (
        <form aria-label="Formulario">
          <EntityCombobox items={items} value={value} onChange={setValue} name="client_id" />
        </form>
      )
    }
    render(<Form />)
    const form = screen.getByRole('form') as HTMLFormElement
    expect(new FormData(form).get('client_id')).toBe('ana')
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }))
    await waitFor(() => expect(new FormData(form).get('client_id')).toBe(''))
  })
  it('does not accept a suggestion when Tab is pressed', () => {
    const onChange = vi.fn()
    render(<EntityCombobox items={items} value="" onChange={onChange} />)
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.change(input, { target: { value: 'An' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
  })
})
