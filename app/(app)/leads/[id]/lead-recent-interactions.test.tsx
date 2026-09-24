import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lead-quick-action-dialogs', () => ({
  QCallDialog: () => <button type="button">Registrar llamada</button>,
  QEmailDialog: () => <button type="button">Registrar email</button>,
  QNoteDialog: () => <button type="button">Añadir nota</button>,
}))

import { LeadRecentInteractions } from './lead-recent-interactions'

const props = {
  leadId: 'lead-1',
  leadName: 'María López',
  leadEmail: 'maria@example.com',
  leadPhone: '600 111 222',
  senderName: 'Ana',
  canEdit: true,
  aiEnabled: false,
  defaultDurationMinutes: null,
  interactions: [],
}

describe('LeadRecentInteractions', () => {
  it('offers shortcuts to add interactions from the history section', () => {
    render(<LeadRecentInteractions {...props} />)

    const quickActions = screen.getByRole('group', { name: 'Acciones rápidas' })
    expect(quickActions.previousElementSibling?.textContent).toContain('Últimas interacciones')
    expect(screen.getByRole('button', { name: 'Añadir nota' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Registrar llamada' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Registrar email' })).toBeDefined()
  })

  it('hides editing shortcuts for read-only users', () => {
    render(<LeadRecentInteractions {...props} canEdit={false} />)

    expect(screen.queryByRole('button', { name: 'Añadir nota' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar llamada' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Registrar email' })).toBeNull()
  })
})
