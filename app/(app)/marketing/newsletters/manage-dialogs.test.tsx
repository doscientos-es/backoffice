import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const updateContact = vi.hoisted(() => vi.fn(async (_form: FormData) => ({ ok: true })))
vi.mock('./actions', () => ({
  updateEmailMarketingContact: updateContact,
  updateEmailMarketingList: vi.fn(),
  updateEmailMarketingSequence: vi.fn(),
  deleteEmailMarketingSequence: vi.fn(),
  removeEmailMarketingContact: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('sileo', () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

import { EditMarketingDialog } from './manage-dialogs'

const contact = {
  id: 'contact-1',
  email: 'ana@example.test',
  name: 'Ana',
  company: null,
  status: 'subscribed' as const,
  unsubscribe_token: 'token',
  unsubscribed_at: null,
}

describe('edición de contactos', () => {
  it('permite corregir el email y solicita confirmación de consentimiento', async () => {
    render(<EditMarketingDialog target={{ kind: 'contact', value: contact }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const email = screen.getByLabelText('Email') as HTMLInputElement
    expect(email.value).toBe('ana@example.test')
    fireEvent.change(email, { target: { value: 'nueva@example.test' } })
    const checkbox = screen.getByRole('checkbox', { name: /autoriza los envíos/ })
    fireEvent.click(checkbox)
    fireEvent.submit(email.closest('form')!)
    await waitFor(() => expect(updateContact).toHaveBeenCalledOnce())
    const form = updateContact.mock.calls[0]?.[0] as unknown as FormData
    expect(form.get('email')).toBe('nueva@example.test')
    expect(form.get('confirmEmailConsent')).toBe('on')
  })

  it('mantiene bloqueada la dirección de un contacto dado de baja', () => {
    render(
      <EditMarketingDialog
        target={{ kind: 'contact', value: { ...contact, status: 'unsubscribed' } }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect((screen.getByLabelText('Email') as HTMLInputElement).readOnly).toBe(true)
    expect(screen.getByText(/email de un contacto dado de baja/)).toBeTruthy()
  })
})
