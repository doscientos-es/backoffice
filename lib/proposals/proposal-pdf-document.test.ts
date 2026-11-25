import { describe, expect, it } from 'vitest'

import { extractPdfPages } from '../internal-documents/pdf-text'
import { DEFAULT_MAINTENANCE_OFFER } from './maintenance'
import {
  type ProposalPdfData,
  printableMarkdown,
  proposalPdfFilename,
  renderProposalPdf,
} from './proposal-pdf-document'

describe('proposal PDF helpers', () => {
  it('creates a download filename from the proposal title and client without accents or unsafe characters', () => {
    expect(proposalPdfFilename(' Integració / logística ', 'Sardà "SL"\r\n')).toBe(
      'Integracio-logistica-Sarda-SL-doscientos.pdf',
    )
  })

  it('uses readable fallbacks when the title or client cannot be used', () => {
    expect(proposalPdfFilename('', '///')).toBe('propuesta-cliente-doscientos.pdf')
  })

  it('keeps both parts in the filename even when the title and client are very long', () => {
    expect(proposalPdfFilename('A'.repeat(300), 'B'.repeat(300))).toBe(
      `${'A'.repeat(100)}-${'B'.repeat(100)}-doscientos.pdf`,
    )
  })

  it('turns the markdown content into PDF-friendly text', () => {
    expect(printableMarkdown('## **Alcance**\n\n[Ver detalle](https://example.test)')).toBe(
      'Alcance Ver detalle',
    )
  })

  it.each([
    ['short', 'Marca', 'Cliente', null],
    ['single long word', 'W'.repeat(20), 'Cliente', null],
    ['short-size limit', 'W'.repeat(80), 'M'.repeat(160), '2026-12-25'],
    ['medium-size limit', 'W'.repeat(140), 'M'.repeat(160), '2026-12-25'],
    ['long words', 'W'.repeat(200), 'M'.repeat(160), '2026-12-25'],
    ['long text', `${'Solución digital '.repeat(11)}integral`, 'Empresa de ejemplo', null],
  ])(
    'keeps %s cover content inside the page without overlapping',
    async (_, title, recipient, validUntil) => {
      const data: ProposalPdfData = {
        number: 'P-001',
        title,
        recipientName: recipient,
        validUntil,
        context: null,
        problems: [],
        solutions: [],
        scopeModules: [],
        deliverables: null,
        acceptanceCriteria: null,
        paymentSchedule: 'half_half',
        paymentTerms: null,
        changeManagementTerms: null,
        legalTerms: 'Condiciones.',
        notes: null,
        subtotal: 1000,
        taxAmount: 210,
        total: 1210,
        items: [],
        maintenanceOffer: DEFAULT_MAINTENANCE_OFFER,
        portalUrl: 'https://example.test/proposal',
        companyName: null,
        iban: null,
      }
      const pdf = await renderProposalPdf(data)
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const task = getDocument({ data: Uint8Array.from(pdf), useWasm: false, useSystemFonts: true })
      try {
        const page = await (await task.promise).getPage(1)
        const viewport = page.getViewport({ scale: 1 })
        const content = await page.getTextContent()
        const items = content.items
          .filter((item) => 'str' in item)
          .filter((item) => item.str.trim() !== '')
        const text = items
          .map((item) => item.str)
          .join('')
          .replace(/[\s-]/g, '')
        expect(text).toContain(title.replace(/\s+/g, ''))
        expect(text).toContain(recipient.replace(/\s+/g, ''))
        expect(text).toContain('Inversióninicial')
        expect(text).toContain('1000,00€')
        expect(text).toContain('Documentoconfidencial')
        if (validUntil) expect(text).toContain('Válidahastael')

        for (const item of items) {
          expect(item.transform[4]).toBeGreaterThanOrEqual(30)
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(viewport.width - 30)
          expect(item.transform[5]).toBeGreaterThan(25)
          expect(item.transform[5] + item.height).toBeLessThan(viewport.height - 25)
        }
        const titleItems = items.filter((item) => item.str.includes(title.slice(0, 3)))
        const recipientItems = items.filter((item) => item.str.includes(recipient.slice(0, 3)))
        const investment = items.find((item) => item.str.includes('1000'))
        expect(titleItems.length).toBeGreaterThan(0)
        expect(recipientItems.length).toBeGreaterThan(0)
        expect(investment).toBeDefined()
        if (!investment) throw new Error('Missing investment amount')
        expect(Math.min(...titleItems.map((item) => item.transform[5]))).toBeGreaterThan(
          Math.max(...recipientItems.map((item) => item.transform[5] + item.height)),
        )
        expect(Math.min(...recipientItems.map((item) => item.transform[5]))).toBeGreaterThan(
          investment.transform[5] + investment.height + 12,
        )
      } finally {
        await task.destroy()
      }
    },
  )

  it.each([
    [
      'ca',
      'Termini estimat: 2 setmanes',
      'Forma de pagament',
      'Signant',
      'Signatura del proveïdor',
      'Descompte',
    ],
    [
      'en',
      'Estimated duration: 2 weeks',
      'Payment terms',
      'Signer',
      'Provider signature',
      'Discount',
    ],
  ] as const)(
    'renders fixed PDF labels in %s without changing contractual content',
    async (language, duration, payment, signer, provider, discount) => {
      const data: ProposalPdfData = {
        language,
        number: 'P-001',
        title: 'Custom title',
        recipientName: 'Example',
        validUntil: '2026-12-25',
        context: 'Custom context',
        problems: [{ id: 'problem', title: 'Custom challenge', description: null }],
        solutions: [{ id: 'solution', title: 'Custom solution', description: null }],
        scopeModules: [
          {
            id: 'scope',
            title: 'Custom scope',
            included: ['Custom inclusion'],
            excluded: ['Custom exclusion'],
            duration_mode: 'weeks',
            duration_weeks: 2,
          },
        ],
        timeline: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            title: 'Timeline milestone',
            description: 'Timeline detail',
            start_date: '2026-12-01',
            end_date: '2026-12-07',
          },
        ],
        deliverables: 'Custom deliverable',
        acceptanceCriteria: 'Custom criteria',
        paymentSchedule: 'half_half',
        paymentTerms: 'Custom payment terms',
        changeManagementTerms: 'Custom scope terms',
        legalTerms: 'Original contractual text',
        notes: null,
        subtotal: 100,
        taxAmount: 21,
        total: 121,
        discounts: { gross: 110, lineDiscount: 10, globalDiscount: 0 },
        items: [
          {
            id: 'item',
            description: 'Custom item',
            quantity: 1,
            unitPrice: 100,
            vatRate: 21,
            subtotal: 100,
            billingCycle: 'monthly',
          },
        ],
        maintenanceOffer: DEFAULT_MAINTENANCE_OFFER,
        portalUrl: 'https://example.test/proposal',
        companyName: 'Example',
        iban: 'TEST-IBAN',
        providerSignature: {
          member_id: '00000000-0000-4000-8000-000000000001',
          name: 'Provider',
          job_title: null,
          drawing: {
            version: 1,
            strokes: [
              [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
              ],
            ],
          },
        },
        acceptance: {
          signerName: 'Client',
          signerRole: null,
          acceptedAt: '2026-09-10T12:34:56.000Z',
          documentHash: 'a'.repeat(64),
          consentText: 'Original consent text',
        },
      }
      const pdf = await renderProposalPdf(data)
      const { pages } = await extractPdfPages(
        pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer,
      )
      const text = pages
        .map((page) => page.content)
        .join(' ')
        .replace(/\s+/g, '')
        .toLocaleUpperCase()
      for (const expected of [
        duration,
        payment,
        signer,
        provider,
        discount,
        'Original contractual text',
        'Original consent text',
        'Custom inclusion',
        'Timeline milestone',
        'Timeline detail',
      ]) {
        expect(text).toContain(expected.replace(/\s+/g, '').toLocaleUpperCase())
      }
      expect(text).not.toContain('PLAZOESTIMADO')
      expect(text).not.toContain('FIRMADELPROVEEDOR')
      expect(pages[0]?.content).not.toMatch(/IVA no inclòs|VAT excluded/i)
      expect(text).not.toMatch(/REVISARIACCEPTARLAPROPOSTA|REVIEWANDACCEPTTHEPROPOSAL/)
    },
  )

  it.each([undefined, null, '', ' \n ', 'Revisión semanal con el cliente.'])(
    'renders a valid PDF with the optional development approach: %s',
    async (developmentApproach) => {
      const data: ProposalPdfData = {
        number: 'P-001',
        title: 'Automatización comercial',
        recipientName: 'Acme SL',
        validUntil: null,
        context: null,
        problems: [],
        solutions: [],
        scopeModules: [
          {
            id: 'scope-1',
            title: 'Portal de clientes',
            description: 'Un espacio privado para clientes.',
            included: ['Acceso con usuarios'],
            excluded: ['Migración histórica'],
            notes: null,
          },
        ],
        deliverables: '- Portal publicado',
        developmentApproach,
        acceptanceCriteria: '- El cliente valida el acceso',
        paymentSchedule: 'half_half',
        paymentTerms: '50 % al aceptar y 50 % a la entrega.',
        changeManagementTerms: 'Los cambios fuera de alcance se presupuestan aparte.',
        legalTerms:
          developmentApproach === undefined
            ? Array.from(
                { length: 28 },
                (_, i) => `${i + 1}. **Cláusula** Condiciones de contratación.`,
              )
                .concat('Fin del contrato.')
                .join('\n\n')
            : 'Condiciones generales de contratación.',
        notes: null,
        subtotal: 1000,
        taxAmount: 210,
        total: 1210,
        items: [
          {
            id: 'item-1',
            description: 'Implementación',
            quantity: 1,
            unitPrice: 1000,
            vatRate: 21,
            subtotal: 1000,
            billingCycle: 'none',
          },
        ],
        maintenanceOffer: DEFAULT_MAINTENANCE_OFFER,
        portalUrl: `https://example.test/p/proposal/${'a'.repeat(48)}?lang=es`,
        canAccept: developmentApproach === undefined,
        companyName: 'Doscientos S.L.',
        iban: 'ES12 3456 7890 1234 5678 9012',
        providerSignature: developmentApproach?.trim()
          ? {
              member_id: '00000000-0000-4000-8000-000000000001',
              name: 'Responsable ficticio',
              job_title: 'Director',
              drawing: {
                version: 1,
                strokes: [
                  [
                    { x: 11, y: 20 },
                    { x: 30, y: 40 },
                  ],
                ],
              },
            }
          : null,
        acceptance: developmentApproach?.trim()
          ? {
              signerName: 'Ana Gómez',
              signerRole: null,
              acceptedAt: '2026-09-10T12:34:56.000Z',
              documentHash: 'a'.repeat(64),
              handwrittenSignature: {
                version: 1,
                strokes: [
                  [
                    { x: 10, y: 20 },
                    { x: 50, y: 60 },
                  ],
                ],
              },
            }
          : null,
      }
      const pdf = await renderProposalPdf(data)

      expect(pdf.subarray(0, 4).toString()).toBe('%PDF')

      const pdfBytes = pdf.buffer.slice(
        pdf.byteOffset,
        pdf.byteOffset + pdf.byteLength,
      ) as ArrayBuffer
      const { pages } = await extractPdfPages(pdfBytes)
      const coverText = pages[0]?.content.replace(/\s+/g, '').toLocaleUpperCase() ?? ''
      const fullText = pages
        .map((page) => page.content)
        .join(' ')
        .replace(/\s+/g, '')
        .toLocaleUpperCase()
      expect(coverText).toContain('INVERSIÓNINICIAL')
      expect(coverText).toContain('1000,00€')
      expect(coverText).not.toMatch(/IVA/)
      expect(coverText).not.toContain('1210,00€')
      expect(fullText).toContain('IVA210,00€')
      expect(fullText).toContain('TOTAL INICIAL PREVISTO CON IVA'.replace(/ /g, ''))
      expect(fullText).toContain('1210,00€')
      expect(fullText).toContain('RECOMENDADO')
      expect(fullText).not.toContain('PLANELEGIDO')
      expect(fullText).not.toContain('SELECCIONADESDELAPROPUESTAONLINE')
      expect(fullText).not.toContain('QUÉINCLUYEESTAPROPUESTA')
      if (data.canAccept) {
        const lastPageText = pages.at(-1)?.content.replace(/\s+/g, '') ?? ''
        expect(lastPageText).toContain('Revisaryaceptarlapropuesta')
        expect(fullText).toContain('FINDELCONTRATO')
        expect(fullText.indexOf('REVISARYACEPTARLAPROPUESTA')).toBeGreaterThan(
          fullText.indexOf('FINDELCONTRATO'),
        )
        const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const task = getDocument({
          data: Uint8Array.from(pdf),
          useWasm: false,
          useSystemFonts: true,
        })
        try {
          const document = await task.promise
          const page = await document.getPage(document.numPages)
          const annotations = await page.getAnnotations()
          expect(annotations).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ subtype: 'Link', url: data.portalUrl }),
            ]),
          )
          const { fnArray, argsArray } = await page.getOperatorList()
          // The QR is a vector of hundreds of filled modules, not a raster image.
          expect(
            fnArray.some(
              (op, i) => op === OPS.constructPath && argsArray[i]?.[1]?.[0]?.length > 1000,
            ),
          ).toBe(true)
        } finally {
          await task.destroy()
        }
      } else {
        expect(fullText).not.toContain('REVISARYACEPTARLAPROPUESTA')
      }
      const heading = 'CÓMOTRABAJAREMOSDURANTEELDESARROLLO'
      if (developmentApproach?.trim()) {
        const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const countPaths = async (bytes: Buffer) => {
          const task = getDocument({
            data: Uint8Array.from(bytes),
            useWorkerFetch: false,
            useWasm: false,
            useSystemFonts: true,
          })
          try {
            const document = await task.promise
            let count = 0
            for (let i = 1; i <= document.numPages; i++) {
              const operators = await (await document.getPage(i)).getOperatorList()
              count += operators.fnArray.filter((op) => op === OPS.constructPath).length
            }
            return count
          } finally {
            await task.destroy()
          }
        }
        if (!data.acceptance) throw new Error('Missing acceptance fixture')
        const withoutDrawing = await renderProposalPdf({
          ...data,
          acceptance: { ...data.acceptance, handwrittenSignature: null },
        })
        expect(await countPaths(pdf)).toBeGreaterThan(await countPaths(withoutDrawing))
        const withoutProvider = await renderProposalPdf({ ...data, providerSignature: null })
        expect(await countPaths(pdf)).toBeGreaterThan(await countPaths(withoutProvider))
        expect(fullText).toContain('RESPONSABLEFICTICIO')
        expect(fullText).toContain(heading)
        expect(fullText).toContain('REVISIÓNSEMANALCONELCLIENTE.')
        expect(fullText.indexOf(heading)).toBeGreaterThan(
          fullText.indexOf('ELCLIENTEVALIDAELACCESO'),
        )
        expect(fullText.indexOf(heading)).toBeLessThan(fullText.indexOf('PROPUESTAECONÓMICA'))
      } else {
        expect(fullText).not.toContain(heading)
      }
    },
  )
})
