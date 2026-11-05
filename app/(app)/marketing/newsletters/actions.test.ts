import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, role } = vi.hoisted(() => ({
  db: {
    results: [] as Array<{
      data?: unknown
      count?: number | null
      error?: { message: string } | null
    }>,
    calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  },
  role: { value: 'admin' },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({
  requireRole: async (roles: string[]) => {
    if (!roles.includes(role.value)) throw new Error('Sin permisos')
    return { id: 'user-id' }
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: (table: string) => {
      const resolve = () => ({ data: null, error: null, ...db.results.shift() })
      const builder: Record<string, unknown> = {}
      for (const method of [
        'select',
        'update',
        'delete',
        'insert',
        'eq',
        'neq',
        'is',
        'in',
        'ilike',
        'limit',
      ]) {
        builder[method] = (...args: unknown[]) => {
          db.calls.push({ table, method, args })
          return builder
        }
      }
      builder.maybeSingle = async () => resolve()
      // Supabase queries are thenable when no terminal method is used.
      builder.then = (callback: (result: unknown) => unknown) =>
        Promise.resolve(resolve()).then(callback)
      return builder
    },
  }),
}))

import {
  addEmailMarketingStep,
  deleteEmailMarketingSequence,
  deleteEmailMarketingStep,
  removeEmailMarketingContact,
  updateEmailMarketingContact,
  updateEmailMarketingList,
} from './actions'

const id = '123e4567-e89b-42d3-a456-426614174000'
const otherId = '123e4567-e89b-42d3-a456-426614174001'

beforeEach(() => {
  db.results = []
  db.calls = []
  role.value = 'admin'
})

describe('gestión de listas y secuencias', () => {
  it('rechaza nombres de lista duplicados sin modificar la lista', async () => {
    db.results = [{ data: { id: otherId } }]
    const result = await updateEmailMarketingList({ id, name: 'Clientes', description: '' })
    expect(result).toMatchObject({ ok: false, error: 'Ya existe una lista con ese nombre.' })
    expect(db.calls.some((call) => call.method === 'update')).toBe(false)
  })

  it('no elimina una secuencia activa ni una con un envío en curso', async () => {
    db.results = [{ data: { id, status: 'active' } }]
    expect(await deleteEmailMarketingSequence({ id })).toMatchObject({
      ok: false,
      error: expect.stringContaining('Pausa'),
    })
    expect(db.calls.some((call) => call.method === 'update')).toBe(false)

    db.results = [{ data: { id, status: 'paused' } }, { count: 1 }]
    expect(await deleteEmailMarketingSequence({ id })).toMatchObject({
      ok: false,
      error: expect.stringContaining('envío en curso'),
    })
    expect(db.calls.some((call) => call.method === 'update')).toBe(false)
  })

  it('archiva una secuencia pausada sin borrar el historial y comprueba que no se haya activado', async () => {
    db.results = [{ data: { id, status: 'paused' } }, { count: 0 }, { data: { id } }]
    expect(await deleteEmailMarketingSequence({ id })).toEqual({ ok: true })
    expect(db.calls).toContainEqual(
      expect.objectContaining({
        table: 'email_marketing_sequences',
        method: 'update',
        args: [expect.objectContaining({ status: 'paused', deleted_at: expect.any(String) })],
      }),
    )
    expect(db.calls).toContainEqual(
      expect.objectContaining({ method: 'neq', args: ['status', 'active'] }),
    )
    expect(db.calls.some((call) => call.method === 'delete')).toBe(false)
  })

  it('retira solo la pertenencia a la lista y comunica si no existe', async () => {
    db.results = [{ data: { contact_id: otherId } }]
    expect(await removeEmailMarketingContact({ listId: id, contactId: otherId })).toEqual({
      ok: true,
    })
    expect(db.calls).toContainEqual(
      expect.objectContaining({
        table: 'email_marketing_list_members',
        method: 'eq',
        args: ['list_id', id],
      }),
    )
    expect(db.calls).toContainEqual(
      expect.objectContaining({
        table: 'email_marketing_list_members',
        method: 'eq',
        args: ['contact_id', otherId],
      }),
    )
    expect(db.calls.some((call) => call.table === 'email_marketing_contacts')).toBe(false)
    db.results = [{ data: null }]
    expect(await removeEmailMarketingContact({ listId: id, contactId: otherId })).toMatchObject({
      ok: false,
    })
  })

  it('edita el contacto sin modificar su email ni su estado de consentimiento', async () => {
    db.results = [{ data: { id } }]
    expect(await updateEmailMarketingContact({ id, name: 'Ana', company: 'Empresa' })).toEqual({
      ok: true,
    })
    expect(db.calls).toContainEqual(
      expect.objectContaining({
        table: 'email_marketing_contacts',
        method: 'update',
        args: [{ name: 'Ana', company: 'Empresa' }],
      }),
    )
  })

  it('no permite añadir correos a secuencias completadas', async () => {
    db.results = [{ data: { id, status: 'completed' } }]
    const result = await addEmailMarketingStep({
      sequenceId: id,
      title: 'Primer email',
      subject: 'Hola',
      bodyMarkdown: 'Contenido',
      scheduledAt: '2099-01-10T10:00',
    })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('completada') })
    expect(db.calls.some((call) => call.method === 'insert')).toBe(false)
  })

  it('no elimina un email en envío y exige permisos de administrador', async () => {
    db.results = [{ data: { id, status: 'sending', tracking_campaign_id: null } }]
    expect(await deleteEmailMarketingStep({ id })).toMatchObject({
      ok: false,
      error: expect.stringContaining('envío'),
    })
    expect(db.calls.some((call) => call.method === 'delete')).toBe(false)
    role.value = 'member'
    expect(await deleteEmailMarketingStep({ id })).toMatchObject({
      ok: false,
      error: 'Sin permisos',
    })
  })
})
