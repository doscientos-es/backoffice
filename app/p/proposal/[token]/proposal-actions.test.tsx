import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({ acceptProposal: vi.fn(), rejectProposal: vi.fn() }))

import { acceptProposal } from './actions'
import { ProposalActions } from './proposal-actions'

const accept = vi.mocked(acceptProposal)
const props = {
  token: '12345678-1234-4123-8123-123456789abc',
  needsFiscal: false,
  signerPrefill: 'Ana Gómez',
  legalTerms: '1. Condiciones de contratación',
  fiscalPrefill: {
    name: '',
    nif: '',
    billing_address: '',
    contact_person: '',
    email: '',
    phone: '',
  },
}

describe('ProposalActions', () => {
  beforeEach(() => {
    accept.mockReset()
    accept.mockResolvedValue({ ok: true })
  })

  it('requires an explicit electronic signature before accepting a proposal', async () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar propuesta' }))

    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith(
        props.token,
        { signer_name: 'Ana Gómez', signer_role: undefined, accepts_terms: true },
        undefined,
      ),
    )
    expect(await screen.findByText('Propuesta firmada y aceptada. Gracias.')).toBeDefined()
  })

  it('lets the signer review the full contractual annex before accepting', () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leer el anexo contractual completo' }))

    expect(screen.getByRole('dialog').textContent).toContain('Condiciones de contratación')
  })
})
