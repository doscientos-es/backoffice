import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({ claimLead: vi.fn() }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn() } }))
vi.mock('../../reminders/schedule-reminder-dialog', () => ({
  ScheduleReminderDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))
vi.mock('../lead-quick-action-dialogs', () => ({
  QuickActionTile: ({ icon, label }: { icon: React.ReactNode; label: string }) => (
    <button type="button">
      {icon}
      {label}
    </button>
  ),
  QCallDialog: () => <button type="button">Llamar</button>,
  QWhatsAppDialog: () => <button type="button">Preparar</button>,
  QSendEmailDialog: () => <button type="button">Enviar</button>,
  QEmailDialog: () => <button type="button">Registrar email</button>,
  QNoteDialog: () => <button type="button">Añadir nota</button>,
  QMeetNowDialog: () => <button type="button">Ahora</button>,
  QMeetDialog: () => <button type="button">Agendar</button>,
}))
vi.mock('./gmail-sync-button', () => ({
  GmailSyncButton: () => <button type="button">Sincronizar</button>,
}))
vi.mock('./extract-tasks-dialog', () => ({
  ExtractTasksDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))

import { LeadQuickActions } from './quick-actions'

const props = {
  leadId: 'lead-1',
  leadName: 'María López',
  leadEmail: 'maria@example.com',
  leadPhone: '600111222',
  senderName: 'Ana',
}

describe('LeadQuickActions', () => {
  it('keeps frequent actions visible and secondary actions collapsed', () => {
    render(<LeadQuickActions {...props} googleEnabled />)

    expect(screen.getByRole('button', { name: 'Llamar' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Preparar' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Enviar' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Agendar' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Añadir nota' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Llamar' }).parentElement?.className).toContain(
      'grid-cols-2',
    )

    fireEvent.click(screen.getByRole('button', { name: /Más acciones/ }))

    expect(screen.getByText('Registrar')).not.toBeNull()
    expect(screen.getByText('Reuniones')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Ahora' }).parentElement?.className).toContain(
      'grid-cols-2',
    )
    expect(screen.getByText('Herramientas')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Añadir nota' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Sincronizar' })).not.toBeNull()
  })
})
