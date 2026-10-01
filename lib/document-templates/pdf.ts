import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib'

import { fieldDefinition } from './fields'
import type { DocumentTemplateField } from './types'

export async function inspectPdfTemplate(bytes: ArrayBuffer): Promise<DocumentTemplateField[]> {
  const pdf = await PDFDocument.load(bytes)
  return pdf
    .getForm()
    .getFields()
    .map((field) => fieldDefinition(field))
}

function truthy(value: unknown) {
  return (
    value === true || ['true', '1', 'yes', 'on', 'si', 'sí'].includes(String(value).toLowerCase())
  )
}

export async function fillPdfTemplate(input: {
  bytes: ArrayBuffer
  fields: DocumentTemplateField[]
  values: Record<string, string | boolean>
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input.bytes)
  const form = pdf.getForm()

  for (const definition of input.fields) {
    const value = input.values[definition.name]
    if (value === undefined || value === null || value === '') continue

    let field: ReturnType<typeof form.getField> | undefined
    try {
      field = form.getField(definition.name)
    } catch {
      continue
    }

    try {
      if (field instanceof PDFTextField) field.setText(String(value))
      else if (field instanceof PDFCheckBox) truthy(value) ? field.check() : field.uncheck()
      else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const option = String(value)
        if (field.getOptions().includes(option)) field.select(option)
      } else if (field instanceof PDFRadioGroup) {
        if (field.getOptions().includes(String(value))) field.select(String(value))
      }

      if (definition.role === 'internal' && String(value).trim()) field.enableReadOnly()
    } catch {
      // A malformed optional field must not prevent generating the rest of the document.
    }
  }

  form.updateFieldAppearances()
  return pdf.save({ useObjectStreams: false })
}
