import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./send-preview-button', () => ({
  SendPreviewButton: () => <button type="button">Enviar preview</button>,
}))

import { ProposalSharingCard } from './proposal-sharing-card'

const props = {
  id: 'proposal-1',
  title: 'Propuesta de prueba',
  token: 'test-token',
  portalViewedAt: null,
  deckViewedAt: null,
  isDraft: true,
  locked: false,
  visible: false,
  hasPassword: true,
  recipientEmail: null,
  alreadySent: false,
  accessAction: vi.fn(async () => ({ ok: true as const })),
}

describe('ProposalSharingCard', () => {
  it('keeps sharing and draft warnings visible while allowing access changes', async () => {
    render(<ProposalSharingCard {...props} />)

    expect(screen.getByText(/estos enlaces dan error 404/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Enviar preview' })).toBeDefined()
    expect(
      screen
        .getByRole('button', { name: 'Compartir enlace de propuesta' })
        .hasAttribute('disabled'),
    ).toBe(true)
    const summary = screen.getByText('Acceso: oculto · con contraseña')
    const details = summary.closest('details')
    expect(details?.hasAttribute('open')).toBe(false)
    fireEvent.click(summary)
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    await waitFor(() =>
      expect(props.accessAction).toHaveBeenCalledWith({
        id: 'proposal-1',
        is_client_visible: true,
      }),
    )
  })

  it('preserves the answered state and omits link controls without a token', () => {
    render(<ProposalSharingCard {...props} token={null} locked isDraft={false} />)

    expect(screen.getByText('La propuesta ya ha sido respondida.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Enviar preview' })).toBeNull()
    expect(screen.queryByText(/Acceso:/)).toBeNull()
    expect(screen.queryByText('Propuesta')).toBeNull()
  })
})
