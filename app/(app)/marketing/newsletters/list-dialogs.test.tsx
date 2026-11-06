import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const addContact = vi.hoisted(() => vi.fn(async (_form: FormData) => ({ ok: true })))
const importContacts = vi.hoisted(() => vi.fn(async (_form: FormData) => ({ ok: true })))
vi.mock('./actions', () => ({
  addEmailMarketingContact: addContact,
  createEmailMarketingList: vi.fn(),
  createEmailMarketingSequence: vi.fn(),
  deleteEmailMarketingList: vi.fn(),
  importEmailMarketingContacts: importContacts,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sileo', () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

import { AddContactDialog, ImportContactsDialog } from './list-dialogs'

describe('contacto manual', () => {
  it('envía los datos y la confirmación de permiso a la lista seleccionada', async () => {
    render(<AddContactDialog list={{ id: 'list-1', name: 'Clientes' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Añadir contacto' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } })
    fireEvent.change(screen.getByLabelText('Nombre (opcional)'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Empresa (opcional)'), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText('Origen del permiso'), {
      target: { value: 'Formulario' },
    })
    fireEvent.change(screen.getByLabelText('Referencia del permiso (opcional)'), {
      target: { value: 'registro-1' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /autorizado recibir/ }))
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
    await waitFor(() => expect(addContact).toHaveBeenCalledOnce())
    const form = addContact.mock.calls[0]![0]
    expect(Object.fromEntries(form.entries())).toMatchObject({
      listId: 'list-1',
      email: 'ana@example.test',
      name: 'Ana',
      company: 'Acme',
      consentSource: 'Formulario',
      consentReference: 'registro-1',
      confirmPermission: 'on',
    })
  })
})

describe('importación de contactos', () => {
  it('permite importar sin casilla de confirmación', async () => {
    render(<ImportContactsDialog list={{ id: 'list-1', name: 'Clientes' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Importar contactos' }))
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.change(screen.getByLabelText('Origen del permiso'), {
      target: { value: 'Formulario' },
    })
    fireEvent.change(screen.getByLabelText('Emails o CSV'), {
      target: { value: 'ana@example.test' },
    })
    fireEvent.submit(screen.getByLabelText('Emails o CSV').closest('form')!)
    await waitFor(() => expect(importContacts).toHaveBeenCalledOnce())
    expect(importContacts.mock.calls[0]![0].has('confirmPermission')).toBe(false)
  })
})
