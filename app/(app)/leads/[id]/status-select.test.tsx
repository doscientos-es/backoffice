import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { updateLeadStatus } from '../actions'
import { LeadStatusSelect } from './status-select'

vi.mock('../actions', () => ({ updateLeadStatus: vi.fn() }))
vi.mock('../close-reason-dialog', () => ({ CloseReasonDialog: () => null }))
vi.mock('../quoted-suggestion-dialog', () => ({ QuotedSuggestionDialog: () => null }))

describe('lead sold product', () => {
  beforeEach(() => {
    vi.mocked(updateLeadStatus).mockReset().mockResolvedValue({ ok: true })
  })
  afterEach(cleanup)

  it('waits for confirmation and sends the selected product with the won status', async () => {
    render(<LeadStatusSelect leadId="lead-1" leadName="Acme" status="new" wonProduct={null} />)
    fireEvent.change(screen.getByLabelText('Estado del lead'), { target: { value: 'won' } })
    expect(updateLeadStatus).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Producto vendido'), { target: { value: 'abaco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como ganado' }))

    await waitFor(() =>
      expect(updateLeadStatus).toHaveBeenCalledWith({
        leadId: 'lead-1',
        status: 'won',
        wonProduct: 'abaco',
      }),
    )
    expect(screen.getByRole('button', { name: 'Ábaco' })).toBeDefined()
  })

  it('allows classifying an existing win without reopening it', async () => {
    render(<LeadStatusSelect leadId="lead-1" leadName="Acme" status="won" wonProduct={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Asignar producto' }))
    fireEvent.change(screen.getByLabelText('Producto vendido'), { target: { value: 'abaco' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar producto' }))

    await waitFor(() =>
      expect(updateLeadStatus).toHaveBeenCalledWith({
        leadId: 'lead-1',
        status: 'won',
        wonProduct: 'abaco',
      }),
    )
  })
})
