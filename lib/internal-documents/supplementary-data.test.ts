// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ log: { error: vi.fn(), warn: vi.fn() } }))

vi.mock('@/lib/logger', () => ({ scopedLogger: () => mocks.log }))

import { loadOptionalInternalDocData } from './supplementary-data'

describe('loadOptionalInternalDocData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns data from a successful optional query', async () => {
    await expect(
      loadOptionalInternalDocData('doc-1', 'extraction', Promise.resolve({ data: { status: 'extracted' }, error: null })),
    ).resolves.toEqual({ status: 'extracted' })
  })

  it('logs the database error code and falls back when the query fails', async () => {
    await expect(
      loadOptionalInternalDocData('doc-1', 'events', Promise.resolve({ data: null, error: { code: 'PGRST205' } })),
    ).resolves.toBeNull()

    expect(mocks.log.warn).toHaveBeenCalledWith(
      { documentId: 'doc-1', source: 'events', errorCode: 'PGRST205' },
      'could not load optional internal document data',
    )
  })

  it('logs safe context and falls back when the query rejects', async () => {
    await expect(
      loadOptionalInternalDocData('doc-1', 'extraction', Promise.reject(new TypeError('network error'))),
    ).resolves.toBeNull()

    expect(mocks.log.error).toHaveBeenCalledWith(
      { documentId: 'doc-1', source: 'extraction', errorType: 'TypeError' },
      'unexpected error loading optional internal document data',
    )
  })
})