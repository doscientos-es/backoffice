import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../reminders/schedule-reminder-dialog', () => ({
  ScheduleReminderDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))
vi.mock('../tasks/actions', () => ({ createTask: vi.fn() }))
vi.mock('./[id]/extract-tasks-dialog', () => ({
  ExtractTasksDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}))
vi.mock('./[id]/gmail-sync-button', () => ({
  GmailSyncButton: () => <button type="button">Sincronizar</button>,
}))
vi.mock('./lead-quick-action-dialogs', () => ({
  QuickActionTile: ({ label }: { label: string }) => <button type="button">{label}</button>,
  QCallDialog: () => <button type="button">Llamar</button>,
  QWhatsAppDialog: () => <button type="button">Preparar</button>,
  QSendEmailDialog: () => <button type="button">Enviar</button>,
  QEmailDialog: () => <button type="button">Registrar</button>,
  QNoteDialog: () => <button type="button">Nota</button>,
  QMeetNowDialog: () => <button type="button">Ahora</button>,
  QMeetDialog: () => <button type="button">Agendar</button>,
}))

import { DrawerQuickActions } from './lead-quick-view'

describe('DrawerQuickActions', () => {
  it('uses the shared compact action groups with every action visible', () => {
    render(
      <DrawerQuickActions
        leadId="lead-1"
        leadName="María López"
        leadEmail="maria@example.com"
        leadPhone="600 111 222"
        senderName="Ana"
        aiEnabled
        googleEnabled
      />,
    )

    for (const name of [
      'Llamar',
      'Preparar',
      'Enviar',
      'Registrar',
      'Nota',
      'Programar',
      'Ahora',
      'Agendar',
      'Sincronizar',
      'Tareas',
    ]) {
      expect(screen.getByRole('button', { name })).not.toBeNull()
    }
    for (const heading of [
      'Acciones rápidas',
      'Contacto',
      'Email',
      'Acciones',
      'Reunión',
      'Herramientas',
    ]) {
      expect(screen.queryByText(heading)).toBeNull()
    }
    expect(screen.queryByRole('button', { name: /Más acciones/ })).toBeNull()
  })
})
