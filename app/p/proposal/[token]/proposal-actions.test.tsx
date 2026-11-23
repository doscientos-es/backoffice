import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./actions', () => ({
  acceptProposal: vi.fn(),
  rejectProposal: vi.fn(),
  trackSignIntent: vi.fn(async () => undefined),
}))

import { acceptProposal, trackSignIntent } from './actions'
import { ProposalActions } from './proposal-actions'

const accept = vi.mocked(acceptProposal)
const signIntent = vi.mocked(trackSignIntent)
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
    signIntent.mockClear()
  })

  it('tells the team when the signature form is opened', () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))

    expect(signIntent).toHaveBeenCalledWith(props.token)
  })

  it('requires an explicit electronic signature before accepting a proposal', async () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Empresa o profesional' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar propuesta' }))

    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith(
        props.token,
        {
          signer_name: 'Ana Gómez',
          signer_role: undefined,
          accepts_terms: true,
          client_capacity: 'business',
          consumer_early_start: false,
        },
        undefined,
      ),
    )
    expect(await screen.findByText('Propuesta firmada y aceptada. Gracias.')).toBeDefined()
  })

  it.each([false, true])('accepts after drawing (cleared: %s)', async (cleared) => {
    render(<ProposalActions {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    const pad = screen.getByRole('group', { name: 'Firma manuscrita (opcional)' })
    vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      width: 300,
      height: 120,
      right: 310,
      bottom: 140,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    })
    fireEvent.pointerDown(pad, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 })
    fireEvent.pointerUp(pad, { pointerId: 1, pointerType: 'touch', clientX: 70, clientY: 60 })
    if (cleared) fireEvent.click(screen.getByRole('button', { name: 'Borrar firma' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Empresa o profesional' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar propuesta' }))

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(1))
    const sent = accept.mock.calls[0]?.[1]
    if (cleared) expect(sent).not.toHaveProperty('handwritten_signature')
    else
      expect(sent).toHaveProperty('handwritten_signature', {
        version: 1,
        strokes: [
          [
            { x: 60, y: 40 },
            { x: 120, y: 80 },
          ],
        ],
      })
  })

  it('records a consumer early-start request only when explicitly checked', async () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Particular (consumidor)' }))
    const [earlyStart, terms] = screen.getAllByRole('checkbox')
    fireEvent.click(earlyStart as HTMLElement)
    fireEvent.click(terms as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar propuesta' }))

    await waitFor(() =>
      expect(accept).toHaveBeenCalledWith(
        props.token,
        expect.objectContaining({ client_capacity: 'consumer', consumer_early_start: true }),
        undefined,
      ),
    )
  })

  it('lets the signer review the full contractual annex before accepting', () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leer el anexo contractual completo' }))

    expect(screen.getByRole('dialog').textContent).toContain('Condiciones de contratación')
  })

  it('requires the client capacity to be selected', async () => {
    render(<ProposalActions {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar propuesta' }))

    expect(
      await screen.findByText('Indica si contratas como empresa/profesional o como consumidor.'),
    ).toBeDefined()
    expect(accept).not.toHaveBeenCalled()
  })
})
