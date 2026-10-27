import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { buildNda } from './clauses'
import { renderNdaPdf } from './pdf'

const data = {
  disclosing: {
    name: 'Doscientos S.L.',
    nif: 'B12345678',
    address: 'Calle Mayor 1\n08001 Barcelona',
  },
  counterparty: { name: 'Acme S.A.', nif: 'A87654321', representative: 'José Antonio Gómez' },
  purpose: 'Evaluar una colaboración',
  confidentialityYears: 3,
  effectiveDate: '2026-10-27',
}

describe('NDA', () => {
  it('fills the lead data into the fixed template', () => {
    const nda = buildNda(data)
    expect(nda.intro[0]).toContain('Acme S.A.')
    expect(nda.intro[0]).toContain('representada por José Antonio Gómez')
    expect(nda.intro[0]).toContain('27 de octubre de 2026')
    expect(nda.clauses[0]?.body).toContain('Evaluar una colaboración')
    expect(nda.clauses.find((c) => c.title.startsWith('5.'))?.body).toContain('3 años')
  })

  it('renders a multi-page-safe PDF, signed or not', async () => {
    const nda = buildNda(data)
    for (const signature of [
      null,
      { name: 'José Antonio Gómez', signedAt: '2026-10-28T10:00:00Z' },
    ]) {
      const bytes = await renderNdaPdf(nda, signature)
      const pdf = await PDFDocument.load(bytes)
      expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1)
    }
  })
})
