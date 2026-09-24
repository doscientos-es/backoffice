import { render, screen } from '@testing-library/react'
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
  it('shows the compact action groups without a collapsible section', () => {
    render(
      <LeadQuickActions
        {...props}
        googleEnabled
        aiEnabled
        createTaskAction={async () => ({ ok: true, id: 'task-1', projectId: null })}
      />,
    )

    for (const name of [
      'Llamar',
      'Preparar',
      'Enviar',
      'Registrar',
      'Programar',
      'Nota',
      'Ahora',
      'Agendar',
      'Sincronizar',
      'Tareas',
    ]) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
    for (const group of ['Contacto', 'Email', 'Acciones', 'Reunión', 'Herramientas']) {
      expect(screen.getByText(group)).not.toBeNull()
    }
    expect(screen.queryByRole('button', { name: /Más acciones/ })).toBeNull()
  })

  it('only shows meeting and sync actions when Google is enabled', () => {
    render(
      <LeadQuickActions
        {...props}
        aiEnabled
        createTaskAction={async () => ({ ok: true, id: 'task-1', projectId: null })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Tareas' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Ahora' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sincronizar' })).toBeNull()
  })
})
