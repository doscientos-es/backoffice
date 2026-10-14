import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, revalidatePath, user } = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  user: { role: 'member' },
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/auth', () => ({
  requireRole: async (roles: string[]) => {
    if (!roles.includes(user.role)) throw new Error('Permission denied')
    return { id: '11111111-1111-4111-8111-111111111111', role: user.role }
  },
}))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/supabase/server', () => ({ createServerClient: async () => ({ rpc }) }))

import { linkProjectRepository } from '../projects/repository-actions'
import { setTaskBlocker } from './blocker-actions'

const id = '22222222-2222-4222-8222-222222222222'
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: { version: 4, projectId: id }, error: null })
  revalidatePath.mockReset()
  user.role = 'member'
})

describe('shared developer workflow actions', () => {
  it('delegates blocker writes and revalidates the task and its project', async () => {
    expect(
      await setTaskBlocker({ taskId: id, expectedVersion: 3, reason: 'Waiting' }),
    ).toMatchObject({ ok: true, version: 4 })
    expect(rpc).toHaveBeenCalledWith('set_task_blocker', {
      p_task_id: id,
      p_expected_version: 3,
      p_reason: 'Waiting',
      p_owner_id: null,
      p_review_on: null,
    })
    expect(revalidatePath).toHaveBeenCalledWith(`/projects/${id}`)
    expect(revalidatePath).toHaveBeenCalledWith(`/tasks/${id}`)
  })

  it('returns a conflict instead of silently overwriting a changed task', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001' } })
    expect(await setTaskBlocker({ taskId: id, expectedVersion: 3, reason: null })).toMatchObject({
      ok: false,
      code: 'conflict',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects malformed input and read-only roles before any RPC', async () => {
    expect(await setTaskBlocker({ taskId: id, expectedVersion: 3, reason: '' })).toMatchObject({
      ok: false,
    })
    user.role = 'viewer'
    expect(
      await setTaskBlocker({ taskId: id, expectedVersion: 3, reason: 'Waiting' }),
    ).toMatchObject({ ok: false })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('links only the repository through the dedicated restricted RPC', async () => {
    await linkProjectRepository({
      projectId: id,
      expectedVersion: 3,
      repository: 'https://github.com/example/project',
    })
    expect(rpc).toHaveBeenCalledWith('link_project_repository', {
      p_project_id: id,
      p_expected_version: 3,
      p_repository: 'https://github.com/example/project',
    })
  })

  it('allows delivery members to link repositories through the permission-checked RPC', async () => {
    user.role = 'delivery'
    expect(
      await linkProjectRepository({
        projectId: id,
        expectedVersion: 3,
        repository: 'https://github.com/example/project',
      }),
    ).toMatchObject({ ok: true })
    expect(rpc).toHaveBeenCalledWith('link_project_repository', {
      p_project_id: id,
      p_expected_version: 3,
      p_repository: 'https://github.com/example/project',
    })
  })

  it('returns repository write failures without revalidating', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Permission denied' } })
    expect(
      await linkProjectRepository({
        projectId: id,
        expectedVersion: 3,
        repository: 'https://github.com/example/project',
      }),
    ).toMatchObject({ ok: false })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
