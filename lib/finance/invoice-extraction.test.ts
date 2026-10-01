import { describe, expect, it } from 'vitest'

import {
  extractExpenseInvoice,
  extractExpenseInvoiceWithRules,
  INVOICE_OCR_LIMITS,
} from './invoice-extraction'

describe('extractExpenseInvoiceWithRules', () => {
  it('extracts common Spanish invoice fields without AI', () => {
    const result = extractExpenseInvoiceWithRules(`
      Factura nº MKT-2026-018
      NIF B12345678
      Fecha de factura: 27/08/2026
      Vencimiento: 15/09/2026
      Base imponible: 1.250,00 EUR
      IVA 21%: 262,50 EUR
    `)

    expect(result).toMatchObject({
      invoice_reference: 'MKT-2026-018',
      vendor_nif: 'B12345678',
      expense_date: '2026-08-27',
      due_date: '2026-09-15',
      subtotal: 1250,
      tax_rate: 21,
    })
  })

  it('leaves unknown fields empty instead of inventing them', () => {
    const result = extractExpenseInvoiceWithRules('Documento sin datos fiscales')
    expect(result.vendor).toBeNull()
    expect(result.subtotal).toBeNull()
    expect(result.expense_date).toBeNull()
  })
})

describe('extractExpenseInvoice review gate', () => {
  it('asks before sending a large image to the AI provider', async () => {
    const result = await extractExpenseInvoice(
      new ArrayBuffer(INVOICE_OCR_LIMITS.automaticBytes + 1),
      'image/jpeg',
    )

    expect(result).toMatchObject({
      requiresConfirmation: true,
      sizeBytes: INVOICE_OCR_LIMITS.automaticBytes + 1,
      pageCount: null,
    })
  })
})
