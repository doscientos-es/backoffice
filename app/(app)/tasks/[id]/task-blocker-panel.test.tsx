import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { action, refresh } = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../blocker-actions', () => ({ setTaskBlocker: action }))

import { TaskBlockerPanel } from './task-blocker-panel'

const props = {
  taskId: 'task-1',
  version: 3,
  reason: null,
  blockedAt: null,
  ownerId: null,
  reviewOn: null,
  members: [{ id: 'member-1', name: 'Ana' }],
  canEdit: true,
  closed: false,
}
afterEach(cleanup)
beforeEach(() => {
  action.mockReset().mockResolvedValue({ ok: true })
  refresh.mockReset()
})

describe('TaskBlockerPanel', () => {
  it('saves a reason and optional owner/date without changing task status', async () => {
    render(<TaskBlockerPanel {...props} />)
    fireEvent.click(screen.getByText('Bloquear tarea'))
    fireEvent.change(screen.getByLabelText('¿Qué impide avanzar?'), {
      target: { value: 'Waiting for design' },
    })
    fireEvent.change(screen.getByLabelText(/Quién puede desbloquear/), {
      target: { value: 'member-1' },
    })
    fireEvent.change(screen.getByLabelText(/Revisar el/), { target: { value: '2026-10-20' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar bloqueo' }).closest('form')!)
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({
        taskId: 'task-1',
        expectedVersion: 3,
        reason: 'Waiting for design',
        ownerId: 'member-1',
        reviewOn: '2026-10-20',
      }),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('clears a blocker explicitly with optimistic concurrency', async () => {
    render(<TaskBlockerPanel {...props} reason="Waiting" blockedAt="2026-10-14T09:00:00Z" />)
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear tarea' }))
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({
        taskId: 'task-1',
        expectedVersion: 3,
        reason: null,
        ownerId: null,
        reviewOn: null,
      }),
    )
  })

  it('shows errors without claiming success', async () => {
    action.mockResolvedValue({ ok: false, error: 'Permission denied' })
    render(<TaskBlockerPanel {...props} reason="Waiting" />)
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear tarea' }))
    await waitFor(() => expect(screen.getByText('Permission denied')).toBeTruthy())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not offer editing to read-only users or blocking closed tasks', () => {
    const { rerender } = render(<TaskBlockerPanel {...props} canEdit={false} reason="Waiting" />)
    expect(screen.queryByText('Editar bloqueo')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desbloquear tarea' })).toBeNull()
    rerender(<TaskBlockerPanel {...props} closed />)
    expect(screen.queryByText('Bloquear tarea')).toBeNull()
  })
})
