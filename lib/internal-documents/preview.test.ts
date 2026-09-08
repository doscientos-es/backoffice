// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  getStorage: vi.fn(),
  log: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({ scopedLogger: () => mocks.log }))
vi.mock('@/lib/storage', () => ({ getStorage: mocks.getStorage }))

import { getInternalDocPreviewUrl } from './preview'

describe('getInternalDocPreviewUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStorage.mockReturnValue({ createSignedUrl: mocks.createSignedUrl })
  })

  it('does not call Storage when the document has no storage path', async () => {
    await expect(getInternalDocPreviewUrl('doc-1', null)).resolves.toBeNull()

    expect(mocks.getStorage).not.toHaveBeenCalled()
  })

  it('returns the signed URL when Storage creates it', async () => {
    mocks.createSignedUrl.mockResolvedValue({ error: null, url: 'https://preview.example/doc' })

    await expect(getInternalDocPreviewUrl('doc-1', 'other/doc-1/file.pdf')).resolves.toBe(
      'https://preview.example/doc',
    )
  })

  it('falls back and logs safe context when Storage returns an error', async () => {
    mocks.createSignedUrl.mockResolvedValue({ error: 'object not found', url: null })

    await expect(getInternalDocPreviewUrl('doc-1', 'other/doc-1/file.pdf')).resolves.toBeNull()
    expect(mocks.log.warn).toHaveBeenCalledWith(
      { documentId: 'doc-1', reason: 'provider_error' },
      'could not generate internal document preview URL',
    )
  })

  it('falls back when Storage throws unexpectedly', async () => {
    mocks.createSignedUrl.mockRejectedValue(new TypeError('network error'))

    await expect(getInternalDocPreviewUrl('doc-1', 'other/doc-1/file.pdf')).resolves.toBeNull()
    expect(mocks.log.error).toHaveBeenCalledWith(
      { documentId: 'doc-1', errorType: 'TypeError' },
      'unexpected error generating internal document preview URL',
    )
  })
})