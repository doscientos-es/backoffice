import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  backupInternalDocToDrive: vi.fn(),
  previewInternalDocEmail: vi.fn(),
  sendInternalDocEmail: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('../actions', () => actions)

import { InternalDocActions } from './internal-doc-actions'

const props = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Política de privacidad.pdf',
  version: 2,
  driveBackupUrl: null,
  driveConfigured: true,
}

describe('InternalDocActions', () => {
  beforeEach(() => {
    actions.backupInternalDocToDrive.mockResolvedValue({ ok: true, version: 2 })
    actions.previewInternalDocEmail.mockResolvedValue({
      ok: true,
      subject: 'Documento · Política de privacidad.pdf',
      html: '<p>Documento</p>',
    })
    actions.sendInternalDocEmail.mockResolvedValue({ ok: true, mocked: false })
  })

  it('warns about an outdated Drive copy and backs up the current version', async () => {
    render(<InternalDocActions {...props} driveBackupVersion={1} />)

    expect(
      screen.getByText('La copia de Drive es de la v1; el documento actual es la v2.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar copia en Drive' }))

    await waitFor(() =>
      expect(actions.backupInternalDocToDrive).toHaveBeenCalledWith({ id: props.id }),
    )
  })

  it('requires a current preview after changing the email content', async () => {
    render(<InternalDocActions {...props} driveBackupVersion={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar por email' }))

    await waitFor(() => expect(actions.previewInternalDocEmail).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText('Email del destinatario'), {
      target: { value: 'ana@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Mensaje adicional (opcional)'), {
      target: { value: 'Te lo envío para tu revisión.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }))
    expect(actions.sendInternalDocEmail).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar vista previa' }))
    await waitFor(() =>
      expect(actions.previewInternalDocEmail).toHaveBeenLastCalledWith({
        id: props.id,
        recipientName: undefined,
        subject: 'Documento · Política de privacidad.pdf',
        message: 'Te lo envío para tu revisión.',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Enviar email' }))

    await waitFor(() =>
      expect(actions.sendInternalDocEmail).toHaveBeenCalledWith({
        id: props.id,
        to: 'ana@example.com',
        recipientName: undefined,
        subject: 'Documento · Política de privacidad.pdf',
        message: 'Te lo envío para tu revisión.',
      }),
    )
  })
})
