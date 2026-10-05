import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { deleteLead, replace } = vi.hoisted(() => ({
  deleteLead: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn(), success: vi.fn() } }))
vi.mock('../actions', () => ({ deleteLead }))

import { LeadDeleteDangerZone } from './lead-delete-danger-zone'

describe('LeadDeleteDangerZone', () => {
  it('asks for confirmation, soft-deletes the lead, and returns to the list', async () => {
    deleteLead.mockResolvedValue({ ok: true })
    render(<LeadDeleteDangerZone leadId="lead-1" leadName="María García" />)

    fireEvent.click(screen.getByRole('button', { name: /zona de peligro/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar lead' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('María García')
    fireEvent.click(screen.getByRole('button', { name: 'Sí, eliminar lead' }))

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith({ id: 'lead-1' }))
    expect(replace).toHaveBeenCalledWith('/leads')
  })
})
