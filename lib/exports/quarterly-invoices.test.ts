import { inflateRawSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import {
  createZip,
  csvWithBom,
  expenseArchiveFilename,
  quarterlyPeriod,
  safeFilePart,
} from './quarterly-invoices'

function readZipEntries(zip: Buffer): Record<string, Buffer> {
  const files: Record<string, Buffer> = {}
  let offset = 0
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8)
    const compressedSize = zip.readUInt32LE(offset + 18)
    const nameLength = zip.readUInt16LE(offset + 26)
    const extraLength = zip.readUInt16LE(offset + 28)
    const nameStart = offset + 30
    const bodyStart = nameStart + nameLength + extraLength
    const body = zip.subarray(bodyStart, bodyStart + compressedSize)
    const name = zip.subarray(nameStart, nameStart + nameLength).toString('utf8')
    files[name] = method === 8 ? inflateRawSync(body) : body
    offset = bodyStart + compressedSize
  }
  return files
}

describe('quarterly invoice export helpers', () => {
  it('resolves a calendar quarter with exclusive end date', () => {
    expect(quarterlyPeriod('2026', '3')).toMatchObject({
      start: '2026-07-01',
      end: '2026-10-01',
      label: 'T3 2026',
    })
    expect(quarterlyPeriod('2026', '5')).toBeNull()
  })

  it('creates safe, descriptive expense filenames', () => {
    expect(safeFilePart('Ácme / S.L.', 'archivo')).toBe('Acme-S.L')
    expect(
      expenseArchiveFilename({
        id: '12345678-0000-0000-0000-000000000000',
        date: '2026-07-03',
        vendor: 'Ácme / S.L.',
        reference: 'F 42/6',
        name: 'Factura julio.PDF',
      }),
    ).toBe('2026-07-03_Acme-S.L_F-42-6_Factura-julio-12345678.pdf')
  })

  it('produces a readable ZIP containing UTF-8 metadata and PDFs', () => {
    const zip = createZip([
      { name: 'gastos/metadatos.csv', body: csvWithBom([{ Proveedor: 'Ácme', Total: '121.00' }]) },
      { name: 'cobros/factura-A-000001.pdf', body: new Uint8Array([1, 2, 3]) },
    ])
    const files = readZipEntries(zip)

    expect(Buffer.from(files['gastos/metadatos.csv'] ?? []).toString('utf8')).toContain('Ácme')
    expect(files['cobros/factura-A-000001.pdf']).toEqual(Buffer.from([1, 2, 3]))
  })
})
