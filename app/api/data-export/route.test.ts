import { beforeEach, describe, expect, it, vi } from 'vitest'

const { state } = vi.hoisted(() => ({
  state: {
    role: 'owner' as 'owner' | 'admin',
    signatureValid: true,
  },
}))
const { createExportDownloadSignature, isValidExportDownloadSignature, streamTableAsCsv, writeAuditEvent } =
  vi.hoisted(() => ({
    createExportDownloadSignature: vi.fn(() => 'signed-link'),
    isValidExportDownloadSignature: vi.fn(() => state.signatureValid),
    streamTableAsCsv: vi.fn(() => new ReadableStream()),
    writeAuditEvent: vi.fn(),
  }))

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(async () => ({ id: 'user-1', role: state.role })),
}))
vi.mock('@/lib/audit/events', () => ({ writeAuditEvent }))
vi.mock('@/lib/exports/download-link', () => ({
  EXPORT_LINK_TTL_SECONDS: 300,
  createExportDownloadSignature,
  isValidExportDownloadSignature,
}))
vi.mock('@/lib/exports/data', () => ({
  isExportableTable: (value: string | null) => value === 'leads',
  streamOperationalDataAsJson: vi.fn(() => new ReadableStream()),
  streamTableAsCsv,
}))
vi.mock('@/lib/logger', () => ({
  scopedLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}))

import { GET, POST } from './route'

function request(url: string, init?: RequestInit): Request {
  return new Request(`https://backoffice.test${url}`, init)
}

describe('data export route', () => {
  beforeEach(() => {
    state.role = 'owner'
    state.signatureValid = true
    vi.clearAllMocks()
  })

  it('issues a short-lived link bound to the authenticated owner and export scope', async () => {
    const response = await POST(
      request('/api/data-export', {
        method: 'POST',
        body: JSON.stringify({ format: 'csv', table: 'leads', includePii: true }),
      }) as never,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      downloadUrl: expect.stringContaining('signature=signed-link'),
    })
    expect(createExportDownloadSignature).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', format: 'csv', table: 'leads', includePii: true }),
    )
  })

  it('does not let an administrator request PII exports', async () => {
    state.role = 'admin'

    const response = await POST(
      request('/api/data-export', {
        method: 'POST',
        body: JSON.stringify({ format: 'csv', table: 'leads', includePii: true }),
      }) as never,
    )

    expect(response.status).toBe(403)
    expect(createExportDownloadSignature).not.toHaveBeenCalled()
  })

  it('rejects a tampered or expired download before streaming data', async () => {
    state.signatureValid = false

    const response = await GET(
      request('/api/data-export?format=csv&table=leads&expires=1800000000&signature=altered') as never,
    )

    expect(response.status).toBe(401)
    expect(streamTableAsCsv).not.toHaveBeenCalled()
  })
})