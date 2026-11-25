import { afterEach, describe, expect, it, vi } from 'vitest'

import { uploadAttachment } from './upload'

class FakeRequest {
  static last: FakeRequest
  upload: {
    onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void
  } = {}
  onload?: () => void
  onerror?: () => void
  onabort?: () => void
  status = 200
  responseText = ''
  open = vi.fn()
  send = vi.fn()

  constructor() {
    FakeRequest.last = this
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('uploadAttachment', () => {
  it('sends the file and entity, reports progress and resolves on success', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest)
    const file = new File(['content'], 'example.pdf', { type: 'application/pdf' })
    const progress = vi.fn()
    const result = uploadAttachment(file, 'lead', 'lead-1', progress)
    const request = FakeRequest.last
    expect(request.open).toHaveBeenCalledWith('POST', '/api/attachments/upload')
    const form = request.send.mock.calls[0]?.[0] as FormData
    expect(form.get('file')).toBe(file)
    expect(form.get('entityType')).toBe('lead')
    expect(form.get('entityId')).toBe('lead-1')
    request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 4 })
    request.upload.onprogress?.({ lengthComputable: false, loaded: 1, total: 4 })
    expect(progress).toHaveBeenCalledOnce()
    expect(progress).toHaveBeenCalledWith(25)
    request.responseText = JSON.stringify({ id: 'new-id' })
    request.onload?.()
    expect(await result).toBeNull()
  })

  it('returns a server error and handles non-JSON responses', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest)
    const file = new File(['x'], 'bad.pdf')
    const result = uploadAttachment(file, 'lead', '1', vi.fn())
    FakeRequest.last.status = 400
    FakeRequest.last.responseText = JSON.stringify({ error: 'Tipo no permitido' })
    FakeRequest.last.onload?.()
    expect(await result).toBe('Tipo no permitido')
    const other = uploadAttachment(file, 'lead', '1', vi.fn())
    FakeRequest.last.status = 502
    FakeRequest.last.responseText = 'bad gateway'
    FakeRequest.last.onload?.()
    expect(await other).toBe('No se pudo subir el archivo')
    const malformed = uploadAttachment(file, 'lead', '1', vi.fn())
    FakeRequest.last.status = 500
    FakeRequest.last.responseText = JSON.stringify({ error: { message: 'unexpected shape' } })
    FakeRequest.last.onload?.()
    expect(await malformed).toBe('No se pudo subir el archivo')
  })

  it('warns about uncertain network failures and handles cancellation', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest)
    const file = new File(['x'], 'example.pdf')
    const failed = uploadAttachment(file, 'lead', '1', vi.fn())
    FakeRequest.last.onerror?.()
    expect(await failed).toContain('Comprueba si el archivo se ha subido')
    const aborted = uploadAttachment(file, 'lead', '1', vi.fn())
    FakeRequest.last.onabort?.()
    expect(await aborted).toBe('La subida se ha cancelado')
  })
})
