import type { ZodIssue } from 'zod'

type ValidationIssue = Pick<ZodIssue, 'message' | 'path'>

const FIELD_LABELS: Record<string, string> = {
  acceptance_criteria: 'Criterios de aceptación',
  change_management_terms: 'Gestión de cambios',
  client_id: 'Destinatario',
  context_markdown: 'Contexto',
  demo_url: 'Enlace de la demo',
  development_approach: 'Cómo trabajaremos durante el desarrollo',
  discount_reason: 'Motivo del descuento global',
  discount_type: 'Descuento global',
  discount_value: 'Valor del descuento global',
  deliverables: 'Entregables',
  notes: 'Notas',
  legal_terms: 'Anexo contractual',
  maintenance_options: 'Mantenimiento',
  payment_plan: 'Facturación por plazos',
  payment_schedule: 'Forma de pago',
  payment_terms: 'Condiciones de pago',
  scope_modules: 'Módulos de alcance',
  terms: 'Condiciones adicionales',
  title: 'Título',
  valid_until: 'Fecha de validez',
}

const NESTED_FIELD_LABELS: Record<string, string> = {
  description: 'Descripción',
  discount_percent: 'Descuento',
  discount_reason: 'Motivo del descuento',
  excluded: 'No incluido',
  included: 'Incluido',
  notes: 'Notas',
  quantity: 'Cantidad',
  title: 'Título',
  unit_price: 'Precio',
  vat_rate: 'IVA',
}

function issueLabel(path: ValidationIssue['path']): string {
  const [section, index, field] = path

  if (section === 'items') {
    if (typeof index === 'number') {
      return `Línea ${index + 1} · ${NESTED_FIELD_LABELS[String(field)] ?? 'Dato'}`
    }
    return 'Líneas de presupuesto'
  }

  if (section === 'scope_modules') {
    if (typeof index === 'number') {
      const label = field === 'title' ? 'Nombre' : (NESTED_FIELD_LABELS[String(field)] ?? 'Dato')
      return `Módulo ${index + 1} · ${label}`
    }
    return FIELD_LABELS.scope_modules ?? 'Módulos de alcance'
  }

  if (section === 'problems' || section === 'solutions') {
    const label = section === 'problems' ? 'Problema' : 'Solución'
    if (typeof index === 'number') {
      return `${label} ${index + 1} · ${NESTED_FIELD_LABELS[String(field)] ?? 'Dato'}`
    }
    return `${label}s`
  }

  return FIELD_LABELS[String(section)] ?? 'Datos de la propuesta'
}

function friendlyMessage(message: string): string {
  if (message === 'String must contain at least 1 character(s)') return 'Campo obligatorio'
  const maxLength = /^String must contain at most (\d+) character\(s\)$/.exec(message)
  if (maxLength) return `Máximo ${maxLength[1]} caracteres`
  const maxNumber = /^Number must be less than or equal to (.+)$/.exec(message)
  if (maxNumber) return `Debe ser como máximo ${maxNumber[1]}`
  const minNumber = /^Number must be greater than or equal to (.+)$/.exec(message)
  if (minNumber) return `Debe ser como mínimo ${minNumber[1]}`
  if (message === 'Required' || message.startsWith('Expected '))
    return 'Dato obligatorio o no válido'
  return message
}

/** Turns schema errors into labels that point to the affected proposal editor field. */
export function formatProposalValidationIssues(issues: readonly ValidationIssue[]): string[] {
  return [
    ...new Set(
      issues.map((issue) => `${issueLabel(issue.path)}: ${friendlyMessage(issue.message)}`),
    ),
  ]
}
