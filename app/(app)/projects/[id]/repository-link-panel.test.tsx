import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { action, refresh } = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('../repository-actions', () => ({ linkProjectRepository: action }))

import { RepositoryLinkPanel } from './repository-link-panel'

const props = {
  projectId: 'project-1',
  version: 4,
  repository: null,
  syncMode: 'none',
  canEdit: true,
}
beforeEach(() => {
  action.mockReset().mockResolvedValue({ ok: true })
  refresh.mockReset()
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('GitHub unavailable')))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RepositoryLinkPanel', () => {
  it('links a pasted URL even when GitHub suggestions are unavailable', async () => {
    render(<RepositoryLinkPanel {...props} />)
    fireEvent.change(screen.getByLabelText('URL del repositorio de GitHub'), {
      target: { value: 'https://github.com/example/project' },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Enlazar repositorio de GitHub' }))
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith({
        projectId: 'project-1',
        expectedVersion: 4,
        repository: 'https://github.com/example/project',
      }),
    )
    expect(refresh).toHaveBeenCalled()
  })

  it('does not change active synchronization or show editing to read-only users', () => {
    const { rerender } = render(
      <RepositoryLinkPanel
        {...props}
        repository="https://github.com/example/project"
        syncMode="bidirectional"
      />,
    )
    expect(screen.queryByRole('button', { name: 'Cambiar enlace' })).toBeNull()
    expect(screen.getByText(/Sincronización activa/)).toBeTruthy()
    rerender(<RepositoryLinkPanel {...props} canEdit={false} />)
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps the form open on a failed write', async () => {
    action.mockResolvedValue({ ok: false, error: 'Version changed' })
    render(<RepositoryLinkPanel {...props} />)
    fireEvent.submit(screen.getByRole('form', { name: 'Enlazar repositorio de GitHub' }))
    await waitFor(() => expect(screen.getByText('Version changed')).toBeTruthy())
    expect(screen.getByLabelText('URL del repositorio de GitHub')).toBeTruthy()
    expect(refresh).not.toHaveBeenCalled()
  })
})
