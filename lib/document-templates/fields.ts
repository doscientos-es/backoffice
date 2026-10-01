import { PDFCheckBox, PDFDropdown, PDFOptionList, PDFRadioGroup } from 'pdf-lib'
import type { PDFField } from 'pdf-lib'

import type {
  DocumentGenerationContext,
  DocumentTemplateField,
  DocumentTemplateFieldKind,
} from './types'

const SOURCE_ALIASES: Record<string, string> = {
  client_name: 'client.name',
  client_company: 'client.name',
  client_legal_name: 'client.name',
  cliente_nombre: 'client.name',
  company_name: 'company.company_name',
  our_company_name: 'company.company_name',
  empresa_nombre: 'company.company_name',
  client_nif: 'client.nif',
  cliente_nif: 'client.nif',
  client_cif: 'client.nif',
  company_nif: 'company.company_nif',
  our_company_nif: 'company.company_nif',
  empresa_nif: 'company.company_nif',
  client_email: 'client.email',
  cliente_email: 'client.email',
  client_phone: 'client.phone',
  client_contact: 'client.contact_person',
  client_contact_person: 'client.contact_person',
  lead_name: 'lead.name',
  lead_company: 'lead.company',
  lead_email: 'lead.email',
  lead_phone: 'lead.phone',
  lead_contact: 'lead.name',
  lead_contact_person: 'lead.name',
  client_address: 'client.billing_address',
  client_address_street: 'client.billing_address_street',
  client_address_zip: 'client.billing_address_zip',
  client_address_city: 'client.billing_address_city',
  client_address_province: 'client.billing_address_province',
  client_address_country: 'client.billing_address_country',
  company_address: 'company.company_address',
  company_address_street: 'company.company_address_street',
  company_address_zip: 'company.company_address_zip',
  company_address_city: 'company.company_address_city',
  company_address_province: 'company.company_address_province',
  company_address_country: 'company.company_address_country',
  project_name: 'project.name',
  proyecto_nombre: 'project.name',
  document_date: 'document.date',
  fecha_documento: 'document.date',
}

function normaliseName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function humaniseName(name: string) {
  return name
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function kindOfPdfField(field: PDFField): DocumentTemplateFieldKind {
  if (field instanceof PDFCheckBox) return 'checkbox'
  if (field instanceof PDFDropdown) return 'dropdown'
  if (field instanceof PDFOptionList) return 'option_list'
  if (field instanceof PDFRadioGroup) return 'radio'
  return 'text'
}

export function fieldDefinition(field: PDFField): DocumentTemplateField {
  const name = field.getName()
  const source = SOURCE_ALIASES[normaliseName(name)] ?? null
  return {
    name,
    label: humaniseName(name),
    kind: kindOfPdfField(field),
    required: field.isRequired(),
    role: source ? 'internal' : 'recipient',
    source,
  }
}

export function getPathValue(source: string, context: DocumentGenerationContext): string {
  if (source === 'document.date') return new Intl.DateTimeFormat('es-ES').format(new Date())
  const [group, ...path] = source.split('.')
  const value =
    group === 'client' && !context.client
      ? leadFallbackForClientPath(path, context.lead)
      : context[group as keyof DocumentGenerationContext]
  if (!value) return ''
  if (source.endsWith('.billing_address')) {
    const parts = [
      value.billing_address_street,
      value.billing_address_zip,
      value.billing_address_city,
      value.billing_address_province,
      value.billing_address_country,
    ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    return parts.join(', ')
  }
  const result = path.reduce<unknown>(
    (current, key) =>
      current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : null,
    value,
  )
  return result == null ? '' : String(result)
}

function leadFallbackForClientPath(
  path: string[],
  lead: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!lead) return null
  const [field] = path
  if (!field) return null
  if (field === 'name') return { name: lead.company ?? lead.name }
  if (field === 'contact_person') return { contact_person: lead.name }
  return { [field]: lead[field] }
}

export function initialValues(
  fields: DocumentTemplateField[],
  context: DocumentGenerationContext,
): Record<string, string> {
  return Object.fromEntries(
    fields
      .filter((field) => field.source)
      .map((field) => [field.name, getPathValue(field.source as string, context)]),
  )
}

export function missingRequiredFields(
  fields: DocumentTemplateField[],
  values: Record<string, string | boolean>,
) {
  return fields.filter(
    (field) =>
      field.role === 'internal' && field.required && !String(values[field.name] ?? '').trim(),
  )
}
