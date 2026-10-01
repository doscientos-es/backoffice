// @vitest-environment node

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

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
    const bytes = await readFile('docs/diagnostico-lead-ejemplo.pdf')
    const result = await extractPdfPages(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    )

    expect(result.pageCount).toBeGreaterThan(0)
    expect(result.pages).not.toHaveLength(0)
    expect(result.pages[0]?.pageNumber).toBe(1)
    expect(result.pages.some((page) => page.content.length > 100)).toBe(true)
    expect(result.truncated).toBe(false)
  })
})
