import { beforeEach, describe, expect, it, vi } from 'vitest'

const { extractPdfPages, isAIEnabled, runAIObject } = vi.hoisted(() => ({
  extractPdfPages: vi.fn(),
  isAIEnabled: vi.fn(() => true),
  runAIObject: vi.fn(),
}))

vi.mock('@/lib/ai', () => ({
  AI_MODELS: { summarizer: 'gemini-3.1-flash-lite' },
  isAIEnabled,
  runAIObject,
}))
vi.mock('@/lib/internal-documents/pdf-text', () => ({ extractPdfPages }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ warn: vi.fn() }) }))

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

const emptySuggestion = {
  vendor: null,
  description: null,
  expense_date: null,
  due_date: null,
  subtotal: null,
  tax_rate: null,
  total: null,
  vendor_nif: null,
  invoice_reference: null,
  confidence: 0,
}

const readableSuggestion = {
  ...emptySuggestion,
  vendor: 'Proveedor de prueba',
  expense_date: '2026-10-01',
  subtotal: 100,
  total: 121,
  tax_rate: 21,
  confidence: 0.92,
}

describe('extractExpenseInvoice PDF visual fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAIEnabled.mockReturnValue(true)
    extractPdfPages.mockResolvedValue({ pageCount: 1, pages: [], truncated: false })
  })

  it('sends a scanned PDF to the existing Gemini Flash-Lite model', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    runAIObject.mockResolvedValueOnce(readableSuggestion)

    const result = await extractExpenseInvoice(bytes)

    expect(result).toMatchObject({
      source: 'ai',
      warning: null,
      suggestion: { vendor: 'Proveedor de prueba', total: 121 },
    })
    expect(runAIObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.1-flash-lite',
        user: [
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'file', mediaType: 'application/pdf' }),
            ]),
          }),
        ],
      }),
    )
    const aiInput = runAIObject.mock.calls[0]?.[0]
    const filePart = aiInput?.user?.[0]?.content?.[1]
    expect(filePart?.data).toBeInstanceOf(Uint8Array)
    expect(filePart?.data).toEqual(new Uint8Array(bytes))
  })

  it('keeps readable text PDFs on the existing single-pass extraction path', async () => {
    extractPdfPages.mockResolvedValueOnce({
      pageCount: 1,
      pages: [{ pageNumber: 1, content: 'Factura digital con texto seleccionable' }],
      truncated: false,
    })
    runAIObject.mockResolvedValueOnce(readableSuggestion)

    const result = await extractExpenseInvoice(new ArrayBuffer(8))

    expect(result).toMatchObject({ source: 'ai', suggestion: { vendor: 'Proveedor de prueba' } })
    expect(runAIObject).toHaveBeenCalledTimes(1)
    expect(runAIObject.mock.calls[0]?.[0].user).toContain('Texto de la factura:')
  })

  it('asks for confirmation before visually analyzing a PDF the parser cannot inspect', async () => {
    extractPdfPages.mockRejectedValue(new Error('Invalid PDF'))
    const bytes = new ArrayBuffer(16)

    const firstResult = await extractExpenseInvoice(bytes)

    expect(firstResult).toMatchObject({ requiresConfirmation: true, pageCount: null })
    expect(runAIObject).not.toHaveBeenCalled()

    runAIObject.mockResolvedValueOnce(readableSuggestion)
    const confirmedResult = await extractExpenseInvoice(bytes, 'application/pdf', {
      confirmLarge: true,
    })

    expect(confirmedResult).toMatchObject({
      source: 'ai',
      suggestion: { vendor: 'Proveedor de prueba' },
    })
    expect(runAIObject).toHaveBeenCalledTimes(1)
  })

  it('uses the PDF image when text-based extraction finds no invoice fields', async () => {
    extractPdfPages.mockResolvedValueOnce({
      pageCount: 1,
      pages: [{ pageNumber: 1, content: 'Texto parcialmente reconocible, sin campos fiscales' }],
      truncated: false,
    })
    runAIObject.mockResolvedValueOnce(emptySuggestion).mockResolvedValueOnce(readableSuggestion)

    const result = await extractExpenseInvoice(new ArrayBuffer(8))

    expect(result).toMatchObject({ source: 'ai', suggestion: { vendor: 'Proveedor de prueba' } })
    expect(runAIObject).toHaveBeenCalledTimes(2)
    expect(runAIObject.mock.calls[0]?.[0].user).toContain('Texto de la factura:')
    expect(runAIObject.mock.calls[1]?.[0].user).toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'user' })]),
    )
  })

  it('does not send PDFs above the provider inline-file limit to Gemini', async () => {
    extractPdfPages.mockResolvedValueOnce({ pageCount: 1, pages: [], truncated: false })

    const result = await extractExpenseInvoice(
      new ArrayBuffer(INVOICE_OCR_LIMITS.visualPdfBytes + 1),
      'application/pdf',
      { confirmLarge: true },
    )

    expect(result).toMatchObject({ source: 'rules', warning: expect.stringContaining('15 MB') })
    expect(runAIObject).not.toHaveBeenCalled()
  })
})
