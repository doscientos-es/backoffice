// @vitest-environment node

import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { extractPdfPages } from './pdf-text'

describe('extractPdfPages', () => {
  it('can load the document actions dependency without native PDF addons', () => {
    // With addons unavailable PDF.js throws DOMMatrix at import time. Merely
    // importing our module must not initialize PDF.js when viewing documents.
    const result = execFileSync(
      process.execPath,
      [
        '--no-addons',
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        'await import("./lib/internal-documents/pdf-text.ts"); console.log("loaded")',
      ],
      { encoding: 'utf8' },
    )
    expect(result.trim()).toBe('loaded')
  })
  it('extracts page-aware native text without OCR', async () => {
    const { PDFDocument, StandardFonts } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const text =
      'Informe de diagnostico comercial del lead con texto nativo suficiente para extraer. '
    pdf.addPage().drawText(text, { x: 20, y: 700, size: 10, font })
    pdf.addPage().drawText(text, { x: 20, y: 700, size: 10, font })
    const bytes = await pdf.save()
    const result = await extractPdfPages(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    )

    expect(result.pageCount).toBe(2)
    expect(result.pages[0]?.pageNumber).toBe(1)
    expect(result.pages.every((page) => page.content.includes('diagnostico'))).toBe(true)
    expect(result.truncated).toBe(false)
  })
})
