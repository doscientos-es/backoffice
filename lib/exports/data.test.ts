import { describe, expect, it } from 'vitest'

import { dataToCsv, sanitizeExportRecord } from './data'

describe('data exports', () => {
  it('removes access credentials from manual exports', () => {
    expect(
      sanitizeExportRecord({
        id: 'row-1',
        name: 'Cliente',
        portal_token: 'private',
        db_pass_encrypted: 'cipher',
      }),
    ).toEqual({ id: 'row-1' })
  })

  it('redacts nested secrets and can keep PII only after explicit opt-in', () => {
    const record = {
      id: 'row-1',
      metadata: { email: 'client@example.test', api_token: 'private' },
      name: 'Cliente',
    }

    expect(sanitizeExportRecord(record)).toEqual({ id: 'row-1', metadata: {} })
    expect(sanitizeExportRecord(record, { includePii: true })).toEqual({
      id: 'row-1',
      metadata: { email: 'client@example.test' },
      name: 'Cliente',
    })
  })

  it('creates a CSV body with quoted JSON values', () => {
    expect(dataToCsv([{ name: 'Doscientos, S.L.', tags: ['crm', 'backup'] }])).toBe(
      '"name","tags"\r\n"Doscientos, S.L.","[""crm"",""backup""]"\r\n',
    )
  })
})
