import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../actions', () => ({ claimLead: vi.fn() }))
vi.mock('sileo', () => ({ sileo: { error: vi.fn() } }))
vi.mock('../../reminders/schedule-reminder-dialog', () => ({
  ScheduleReminderDialog: ({ trigger, open }: { trigger: React.ReactNode; open: boolean }) => (
    <>
      {trigger}
      {open && <div role="dialog" aria-label="Programar llamada" />}
    </>
  ),
}))
vi.mock('../lead-quick-action-dialogs', () => ({
  QuickActionTile: ({ icon, label }: { icon: React.ReactNode; label: string }) => (
    <button type="button">
      {icon}
      {label}
    </button>
  ),
  QCallDialog: ({ openInitially }: { openInitially?: boolean }) => (
    <>
      <button type="button">Registrar llamada</button>
      {openInitially && <div role="dialog" aria-label="Registrar llamada" />}
    </>
  ),
  QWhatsAppDialog: () => <button type="button">Preparar</button>,
  QSendEmailDialog: () => <button type="button">Enviar</button>,
  QEmailDialog: () => <button type="button">Registrar</button>,
  QNoteDialog: () => <button type="button">Nota</button>,
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
  it('keeps primary actions visible and reveals secondary actions on demand', () => {
    render(
      <LeadQuickActions
        {...props}
        googleEnabled
        aiEnabled
        createTaskAction={async () => ({ ok: true, id: 'task-1', projectId: null })}
      />,
    )

    expect(screen.getByRole('link', { name: 'Llamar' })).not.toBeNull()
    for (const name of ['Preparar', 'Enviar', 'Programar']) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
    const toggle = screen.getByRole('button', { name: 'Más acciones' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    for (const name of [
      'Registrar llamada',
      'Registrar',
      'Nota',
      'Ahora',
      'Agendar',
      'Sincronizar',
      'Tareas',
    ]) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
    expect(screen.getByRole('region', { name: 'Acciones rápidas' })).not.toBeNull()
    fireEvent.click(toggle)
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull()
  })

  it('only shows meeting and sync actions when Google is enabled', () => {
    render(
      <LeadQuickActions
        {...props}
        aiEnabled
        createTaskAction={async () => ({ ok: true, id: 'task-1', projectId: null })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }))
    expect(screen.getByRole('button', { name: 'Tareas' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ahora' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sincronizar' })).toBeNull()
  })

  it('keeps direct links to the call and scheduling dialogs functional', () => {
    const { unmount } = render(<LeadQuickActions {...props} openCallInitially />)
    expect(screen.getByRole('dialog', { name: 'Registrar llamada' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Más acciones' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
    unmount()

    render(<LeadQuickActions {...props} openScheduleInitially />)
    expect(screen.getByRole('dialog', { name: 'Programar llamada' })).not.toBeNull()
  })
})
