import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { LeadListItem } from '@/lib/leads/types'
import { leadFixture } from '@/tests/fixtures/leads'

const { loadDrawer } = vi.hoisted(() => ({ loadDrawer: vi.fn() }))
vi.mock('./lead-quick-view', () => {
  loadDrawer()
  return {
    LeadQuickView: ({ lead }: { lead: LeadListItem | null }) => (
      <output aria-label="Ficha rápida">{lead?.name ?? 'Cerrada'}</output>
    ),
  }
})

import { LeadQuickView } from './lazy-lead-quick-view'

describe('lazy lead quick view', () => {
  afterEach(cleanup)

  it('downloads forms only on first use and retains the mounted drawer when closed', async () => {
    const onCloseAction = vi.fn()
    const { rerender } = render(<LeadQuickView lead={null} onCloseAction={onCloseAction} />)
    expect(loadDrawer).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Ficha rápida')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()

    const lead = leadFixture()
    rerender(<LeadQuickView lead={lead} onCloseAction={onCloseAction} />)
    await waitFor(() => expect(screen.getByLabelText('Ficha rápida').textContent).toBe(lead.name))
    expect(loadDrawer).toHaveBeenCalledTimes(1)

    rerender(<LeadQuickView lead={null} onCloseAction={onCloseAction} />)
    expect(screen.getByLabelText('Ficha rápida').textContent).toBe('Cerrada')
    rerender(
      <LeadQuickView
        lead={leadFixture({ name: 'Segundo contacto' })}
        onCloseAction={onCloseAction}
      />,
    )
    expect(screen.getByLabelText('Ficha rápida').textContent).toBe('Segundo contacto')
    expect(loadDrawer).toHaveBeenCalledTimes(1)
  })
})
