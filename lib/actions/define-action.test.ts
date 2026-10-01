import { describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(),
  requireRole: vi.fn(),
}))

import { friendlyErrorMessage } from '@/lib/actions/define-action'

describe('friendlyErrorMessage', () => {
  it('maps Postgres error codes', () => {
    expect(friendlyErrorMessage({ code: '23505', message: 'x' })).toBe(
      'Ya existe un registro con esos datos.',
    )
    expect(friendlyErrorMessage({ code: '23503', message: 'x' })).toBe(
      'No se puede completar: hay registros relacionados que lo impiden.',
    )
    expect(friendlyErrorMessage({ code: '42501', message: 'x' })).toBe(
      'No tienes permisos para realizar esta acción.',
    )
    expect(friendlyErrorMessage({ code: 'PGRST116', message: 'x' })).toBe(
      'No se encontró el registro; puede que se haya eliminado.',
    )
  })

  it('maps raw messages without a code', () => {
    expect(friendlyErrorMessage(new Error('duplicate key value violates unique constraint'))).toBe(
      'Ya existe un registro con esos datos.',
    )
    expect(friendlyErrorMessage(new Error('TypeError: fetch failed'))).toBe(
      'Problema de conexión. Inténtalo de nuevo en unos segundos.',
    )
  })

  it('keeps unknown messages and falls back for non-errors', () => {
    expect(friendlyErrorMessage(new Error('La factura ya está emitida'))).toBe(
      'La factura ya está emitida',
    )
    expect(friendlyErrorMessage(undefined)).toBe('Algo ha fallado. Inténtalo de nuevo.')
    expect(friendlyErrorMessage('boom')).toBe('Algo ha fallado. Inténtalo de nuevo.')
  })
})
