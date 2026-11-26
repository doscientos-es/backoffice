import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { createLeadBilling, refresh } = vi.hoisted(() => ({
  createLeadBilling: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/app/(app)/clients/actions', () => ({ createLeadBilling }))
vi.mock('@/app/(app)/clients/client-form-fields', () => ({
  ClientFormFields: ({ defaults }: { defaults: { name: string } }) => (
    <label>
      Razón social
      <input name="name" defaultValue={defaults.name} />
    </label>
  ),
}))

import { LeadBillingCreateDialog } from './lead-billing-create-dialog'

describe('LeadBillingCreateDialog', () => {
  it('submits the lead and editable billing data and refreshes after saving', async () => {
    createLeadBilling.mockResolvedValue({ ok: true, clientId: 'client-1' })
    render(<LeadBillingCreateDialog leadId="lead-1" defaults={{ name: 'Empresa ficticia' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Nombre fiscal' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const submitted = createLeadBilling.mock.calls[0]?.[0] as FormData
    expect(submitted.get('leadId')).toBe('lead-1')
    expect(submitted.get('name')).toBe('Nombre fiscal')
  })
})
