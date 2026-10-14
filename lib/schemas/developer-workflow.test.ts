import { describe, expect, it } from 'vitest'

import { LinkProjectRepositoryInput, SetTaskBlockerInput } from './developer-workflow'

const id = '11111111-1111-4111-8111-111111111111'

describe('developer workflow inputs', () => {
  it('requires a reason or explicit null and a current version', () => {
    expect(
      SetTaskBlockerInput.safeParse({ taskId: id, expectedVersion: 1, reason: ' ' }).success,
    ).toBe(false)
    expect(SetTaskBlockerInput.safeParse({ taskId: id, reason: 'Waiting' }).success).toBe(false)
    expect(
      SetTaskBlockerInput.parse({ taskId: id, expectedVersion: 1, reason: null }),
    ).toMatchObject({ reason: null, ownerId: null, reviewOn: null })
    expect(
      SetTaskBlockerInput.parse({ taskId: id, expectedVersion: 1, reason: '  Waiting  ' }).reason,
    ).toBe('Waiting')
  })

  it('validates bounded reasons, owner IDs and real review dates', () => {
    for (const patch of [
      { reason: 'a'.repeat(1001) },
      { ownerId: 'invalid' },
      { reviewOn: '2026-02-30' },
    ]) {
      expect(
        SetTaskBlockerInput.safeParse({
          taskId: id,
          expectedVersion: 1,
          reason: 'Waiting',
          ...patch,
        }).success,
      ).toBe(false)
    }
  })

  it('accepts GitHub HTTPS repository links including dotted names', () => {
    for (const repository of [
      'https://github.com/example/project',
      'https://github.com/example/project.git/',
      'https://github.com/example/project.web',
    ]) {
      expect(
        LinkProjectRepositoryInput.safeParse({ projectId: id, expectedVersion: 1, repository })
          .success,
      ).toBe(true)
    }
  })

  it('rejects non-repository URLs and embedded credentials', () => {
    for (const repository of [
      'https://example.test/org/repo',
      'https://github.com/example/repo/issues',
      'https://github.com/example/repo?token=placeholder',
      'https://user:placeholder@github.com/example/repo',
      'https://github.com/example/..',
      'https://github.com/example/.git',
    ]) {
      expect(
        LinkProjectRepositoryInput.safeParse({ projectId: id, expectedVersion: 1, repository })
          .success,
      ).toBe(false)
    }
  })
})
