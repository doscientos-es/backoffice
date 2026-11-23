import { describe, expect, it } from 'vitest'

import { formatProposalValidationIssues } from './validation'

describe('formatProposalValidationIssues', () => {
  it('identifies nested proposal fields in actionable language', () => {
    expect(
      formatProposalValidationIssues([
        { path: ['scope_modules', 0, 'title'], message: 'El nombre del módulo es obligatorio' },
        { path: ['items', 1, 'quantity'], message: 'Cantidad > 0' },
      ]),
    ).toEqual([
      'Módulo 1 · Nombre: El nombre del módulo es obligatorio',
      'Línea 2 · Cantidad: Cantidad > 0',
    ])
  })

  it('removes duplicated messages from repeated validation attempts', () => {
    expect(
      formatProposalValidationIssues([
        { path: ['title'], message: 'Required' },
        { path: ['title'], message: 'Required' },
      ]),
    ).toEqual(['Título: Dato obligatorio o no válido'])
  })

  it('explains generic schema limits in Spanish', () => {
    expect(
      formatProposalValidationIssues([
        { path: ['items', 0, 'vat_rate'], message: 'Number must be less than or equal to 100' },
        { path: ['title'], message: 'String must contain at most 200 character(s)' },
      ]),
    ).toEqual(['Línea 1 · IVA: Debe ser como máximo 100', 'Título: Máximo 200 caracteres'])
  })
})
