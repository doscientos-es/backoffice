import { type PDFFont, PDFDocument, StandardFonts, rgb } from 'pdf-lib'

import { type NdaDocument, formatNdaDate } from './clauses'

export type NdaSignature = { name: string; signedAt: string }

const PAGE = { width: 595.28, height: 841.89, margin: 56 }
const BODY_SIZE = 10.5
const LINE_HEIGHT = 15

/** Splits text into lines that fit `maxWidth` for the given font and size. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let current = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current)
        current = word
      } else {
        current = candidate
      }
    }
    lines.push(current)
  }
  return lines
}

export async function renderNdaPdf(
  nda: NdaDocument,
  signature: NdaSignature | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(nda.title)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const maxWidth = PAGE.width - PAGE.margin * 2

  let page = pdf.addPage([PAGE.width, PAGE.height])
  let y = PAGE.height - PAGE.margin

  const ensureSpace = (needed: number) => {
    if (y - needed >= PAGE.margin) return
    page = pdf.addPage([PAGE.width, PAGE.height])
    y = PAGE.height - PAGE.margin
  }

  const drawLines = (lines: string[], font: PDFFont, size: number) => {
    for (const line of lines) {
      ensureSpace(LINE_HEIGHT)
      page.drawText(line, { x: PAGE.margin, y, size, font, color: rgb(0.1, 0.1, 0.1) })
      y -= LINE_HEIGHT
    }
  }

  drawLines(wrapText(nda.title, bold, 16, maxWidth), bold, 16)
  y -= 10
  for (const paragraph of nda.intro) {
    drawLines(wrapText(paragraph, regular, BODY_SIZE, maxWidth), regular, BODY_SIZE)
    y -= 6
  }
  for (const clause of nda.clauses) {
    y -= 6
    ensureSpace(LINE_HEIGHT * 3)
    drawLines([clause.title], bold, BODY_SIZE)
    drawLines(wrapText(clause.body, regular, BODY_SIZE, maxWidth), regular, BODY_SIZE)
  }

  y -= 24
  ensureSpace(LINE_HEIGHT * 5)
  drawLines(['Firma de la Otra Parte'], bold, BODY_SIZE)
  if (signature) {
    drawLines([`Firmado electrónicamente por ${signature.name}`], regular, BODY_SIZE)
    drawLines([`Fecha: ${formatNdaDate(signature.signedAt.slice(0, 10))}`], regular, BODY_SIZE)
  } else {
    drawLines(['Pendiente de firma.'], regular, BODY_SIZE)
  }

  return pdf.save()
}
