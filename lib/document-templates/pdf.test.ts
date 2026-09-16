import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { inspectPdfTemplate, fillPdfTemplate } from './pdf'

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('document PDF templates', () => {
  it('detects mapped and recipient fields', async () => {
    const document = await PDFDocument.create()
    const form = document.getForm()
    form.createTextField('client_name').enableRequired()
    form.createTextField('representative_name')

    const fields = await inspectPdfTemplate(asArrayBuffer(await document.save()))

    expect(fields).toEqual([
      expect.objectContaining({
        name: 'client_name',
        role: 'internal',
        source: 'client.name',
        required: true,
      }),
      expect.objectContaining({ name: 'representative_name', role: 'recipient', source: null }),
    ])
  })

  it('prefills internal fields and keeps recipient fields editable', async () => {
    const document = await PDFDocument.create()
    const form = document.getForm()
    form.createTextField('client_name')
    form.createTextField('representative_name')
    const input = asArrayBuffer(await document.save())

    const output = await fillPdfTemplate({
      bytes: input,
      fields: [
        {
          name: 'client_name',
          label: 'Client name',
          kind: 'text',
          required: true,
          role: 'internal',
          source: 'client.name',
        },
        {
          name: 'representative_name',
          label: 'Representative name',
          kind: 'text',
          required: false,
          role: 'recipient',
          source: null,
        },
      ],
      values: { client_name: 'Doscientos' },
    })

    const result = await PDFDocument.load(output)
    const resultForm = result.getForm()
    expect(resultForm.getTextField('client_name').getText()).toBe('Doscientos')
    expect(resultForm.getTextField('client_name').isReadOnly()).toBe(true)
    expect(resultForm.getTextField('representative_name').isReadOnly()).toBe(false)
  })
})
