import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { updateLead, refresh } = vi.hoisted(() => ({ updateLead: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../actions', () => ({ updateLead }))

import { LeadEditDialog } from './lead-edit-dialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const lead = {
  id: 'lead-1',
  name: 'Empresa de prueba',
  alias: null,
  company: null,
  email: null,
  logo_url: null,
  phone: null,
  source: null,
  language: null,
  notes: null,
  estimated_value: null,
  company_size: null,
  solution_type: null,
  urgency: null,
  assigned_to: null,
  version: 1,
}

describe('lead logo editing', () => {
  it('saves a new logo as part of the lead without billing data', async () => {
    updateLead.mockResolvedValue({ ok: true, version: 2 })
    render(<LeadEditDialog lead={lead} />)
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Editar lead' }))
    expect(dialog.getByText(/Logo del lead/)).toBeTruthy()
    fireEvent.change(dialog.getByPlaceholderText('https://empresa.com/logo.png'), {
      target: { value: 'https://example.test/logo.png' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Usar URL' }))
    fireEvent.click(dialog.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() =>
      expect(updateLead).toHaveBeenCalledWith(
        expect.objectContaining({
          id: lead.id,
          expected_version: 1,
          logo_url: 'https://example.test/logo.png',
        }),
      ),
    )
    expect(refresh).toHaveBeenCalled()
  })
})
