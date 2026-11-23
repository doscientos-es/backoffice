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
  it('creates a safe download filename from the proposal number', () => {
    expect(proposalPdfFilename('P/2026 001', 'fallback-id')).toBe('propuesta-P-2026-001.pdf')
    expect(proposalPdfFilename(null, 'fallback-id')).toBe('propuesta-fallback-id.pdf')
  })

  it('turns the markdown content into PDF-friendly text', () => {
    expect(printableMarkdown('## **Alcance**\n\n[Ver detalle](https://example.test)')).toBe(
      'Alcance Ver detalle',
    )
  })

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
      ]) {
        expect(text).toContain(expected.replace(/\s+/g, '').toLocaleUpperCase())
      }
      expect(text).not.toContain('PLAZOESTIMADO')
      expect(text).not.toContain('FIRMADELPROVEEDOR')
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
        legalTerms: 'Condiciones generales de contratación.',
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
        portalUrl: 'https://example.test/p/proposal/token',
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
      expect(coverText).toContain('(IVANOINCLUIDO)')
      expect(coverText).not.toContain('1210,00€')
      expect(fullText).toContain('SEAÑADIRÁELIVACORRESPONDIENTE')
      expect(fullText).toContain('TOTAL INICIAL PREVISTO CON IVA'.replace(/ /g, ''))
      expect(fullText).toContain('1210,00€')
      expect(fullText).toContain('RECOMENDADO')
      expect(fullText).not.toContain('PLANELEGIDO')
      expect(fullText).not.toContain('SELECCIONADESDELAPROPUESTAONLINE')
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
        expect(fullText.indexOf(heading)).toBeLessThan(fullText.indexOf('INVERSIÓNYALCANCE'))
      } else {
        expect(fullText).not.toContain(heading)
      }
    },
  )
})
