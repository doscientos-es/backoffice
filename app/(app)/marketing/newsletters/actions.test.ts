import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, role, processor, sendTest } = vi.hoisted(() => ({
  db: {
    results: [] as Array<{
      data?: unknown
      count?: number | null
      error?: { message: string; code?: string } | null
    }>,
    calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
  },
  role: { value: 'admin' },
  processor: vi.fn(),
  sendTest: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/logger', () => ({ scopedLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }))
vi.mock('@/lib/env', () => ({
  serverEnv: () => ({ RESEND_API_KEY: 'fake-test-key', EMAIL_MARKETING_RESEND_API_KEY: '' }),
}))
vi.mock('@/lib/marketing/email-marketing', () => ({ processDueEmailMarketing: processor }))
vi.mock('@/lib/marketing/send-test', () => ({ sendMarketingTest: sendTest }))
vi.mock('@/lib/auth', () => ({
  requireRole: async (roles: string[]) => {
    if (!roles.includes(role.value)) throw new Error('Sin permisos')
    return { id: 'user-id', name: 'Ana', email: 'ana@example.test' }
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
        'upsert',
        'eq',
        'neq',
        'is',
        'in',
        'ilike',
        'limit',
        'order',
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
  addEmailMarketingContact,
  addEmailMarketingStep,
  deleteEmailMarketingSequence,
  deleteEmailMarketingStep,
  importEmailMarketingContacts,
  removeEmailMarketingContact,
  sendEmailMarketingStepNow,
  sendEmailMarketingTest,
  sendSavedEmailMarketingTest,
  unsubscribeMarketingContact,
  updateEmailMarketingContact,
  updateEmailMarketingList,
} from './actions'

const id = '123e4567-e89b-42d3-a456-426614174000'
const otherId = '123e4567-e89b-42d3-a456-426614174001'

beforeEach(() => {
  db.results = []
  db.calls = []
  role.value = 'admin'
  processor.mockReset().mockResolvedValue({ sent: 1, failed: 0 })
  sendTest.mockReset().mockResolvedValue(undefined)
})

describe('añadir contactos manualmente', () => {
  const contact = {
    listId: id,
    email: ' Ana@Example.test ',
    name: 'Ana, López',
    company: 'Empresa',
    consentSource: 'Formulario web',
    consentReference: 'registro-1',
    confirmPermission: 'on',
  }

  it('crea el contacto y lo vincula con la evidencia del permiso', async () => {
    db.results = [
      { data: { id } },
      { data: [] },
      { data: [{ id: 'lead-1', email: 'ana@example.test' }] },
      { data: [{ id: otherId, email: 'ana@example.test' }] },
      {},
    ]
    expect(await addEmailMarketingContact(contact)).toEqual({ ok: true })
    expect(db.calls).toContainEqual({
      table: 'email_marketing_contacts',
      method: 'upsert',
      args: [
        [
          expect.objectContaining({
            email: 'ana@example.test',
            name: 'Ana, López',
            company: 'Empresa',
            lead_id: 'lead-1',
            status: 'subscribed',
            consent_source: 'Formulario web',
          }),
        ],
        { onConflict: 'email', ignoreDuplicates: true },
      ],
    })
    expect(db.calls).toContainEqual({
      table: 'email_marketing_list_members',
      method: 'upsert',
      args: [
        [
          expect.objectContaining({
            list_id: id,
            contact_id: otherId,
            consent_source: 'Formulario web',
            consent_reference: 'registro-1',
            consented_at: expect.any(String),
          }),
        ],
        { onConflict: 'list_id,contact_id', ignoreDuplicates: true },
      ],
    })
  })

  it('reutiliza contactos suscritos sin sobrescribir sus datos', async () => {
    db.results = [
      { data: { id } },
      {
        data: [{ id: otherId, email: 'ana@example.test', status: 'subscribed', lead_id: 'lead-1' }],
      },
      { data: [] },
      {},
    ]
    expect(await addEmailMarketingContact(contact)).toEqual({ ok: true })
    expect(
      db.calls.some(
        (call) =>
          call.table === 'email_marketing_contacts' && ['update', 'upsert'].includes(call.method),
      ),
    ).toBe(false)
    expect(
      db.calls.some(
        (call) => call.table === 'email_marketing_list_members' && call.method === 'upsert',
      ),
    ).toBe(true)
  })

  it.each(['unsubscribed', 'bounced', 'complained'])('no reactiva contactos %s', async (status) => {
    db.results = [
      { data: { id } },
      { data: [{ id: otherId, email: 'ana@example.test', status, lead_id: null }] },
      { data: [] },
    ]
    expect(await addEmailMarketingContact(contact)).toMatchObject({
      ok: false,
      error: expect.stringContaining('baja'),
    })
    expect(db.calls.some((call) => ['upsert', 'update'].includes(call.method))).toBe(false)
  })

  it('valida email, permiso, lista y rol antes de guardar', async () => {
    expect(await addEmailMarketingContact({ ...contact, email: 'incorrecto' })).toMatchObject({
      ok: false,
    })
    expect(
      await addEmailMarketingContact({ ...contact, confirmPermission: undefined }),
    ).toMatchObject({ ok: false })
    role.value = 'viewer'
    expect(await addEmailMarketingContact(contact)).toMatchObject({ ok: false })
    expect(db.calls).toHaveLength(0)
    role.value = 'admin'
    db.results = [{ data: null }]
    expect(await addEmailMarketingContact(contact)).toMatchObject({
      ok: false,
      error: expect.stringContaining('lista'),
    })
    expect(db.calls.some((call) => call.method === 'upsert')).toBe(false)
  })

  it('conserva el flujo de importación CSV', async () => {
    db.results = [
      { data: { id } },
      { data: [] },
      { data: [] },
      { data: [{ id: otherId, email: 'ana@example.test' }] },
      {},
    ]
    expect(
      await importEmailMarketingContacts({
        listId: id,
        csv: 'ana@example.test,Ana,Empresa',
        consentSource: 'Formulario',
      }),
    ).toEqual({ ok: true, addedToList: 1, suppressed: 0 })
  })
})

describe('gestión de listas y secuencias', () => {
  const step = {
    sequenceId: id,
    title: 'Correo',
    subject: 'Hola {{nombre}}',
    bodyMarkdown: 'Contenido',
    scheduledAt: '2099-01-10T10:00',
  }

  it('programa sin enviar prueba si no se solicita', async () => {
    db.results = [{ data: { id, status: 'active' } }, { data: null }, {}]
    expect(await addEmailMarketingStep(step)).toEqual({ ok: true })
    expect(sendTest).not.toHaveBeenCalled()
  })

  it('envía la prueba al usuario después de programar', async () => {
    db.results = [{ data: { id, status: 'active' } }, { data: null }, {}]
    expect(await addEmailMarketingStep({ ...step, sendTest: 'on' })).toMatchObject({
      ok: true,
      successMessage: expect.stringContaining('ana@example.test'),
    })
    expect(sendTest).toHaveBeenCalledWith(
      expect.objectContaining({ subject: step.subject }),
      expect.objectContaining({ email: 'ana@example.test' }),
    )
    expect(db.calls.filter((call) => call.method === 'insert')).toHaveLength(1)
  })

  it('avisa de fallo parcial sin volver a crear la programación', async () => {
    sendTest.mockRejectedValueOnce(new Error('Resend unavailable'))
    db.results = [{ data: { id, status: 'active' } }, { data: null }, {}]
    expect(await addEmailMarketingStep({ ...step, sendTest: 'on' })).toMatchObject({
      ok: true,
      warning: expect.stringContaining('está planificado'),
    })
    expect(db.calls.filter((call) => call.method === 'insert')).toHaveLength(1)
  })

  it('no envía la prueba si falla la programación', async () => {
    db.results = [
      { data: { id, status: 'active' } },
      { data: null },
      { error: { message: 'error' } },
    ]
    expect(await addEmailMarketingStep({ ...step, sendTest: 'on' })).toMatchObject({ ok: false })
    expect(sendTest).not.toHaveBeenCalled()
  })

  it('permite una prueba independiente sin programar y requiere permisos', async () => {
    expect(await sendEmailMarketingTest(step)).toEqual({ ok: true, email: 'ana@example.test' })
    expect(db.calls).toHaveLength(0)
    role.value = 'viewer'
    expect(await sendEmailMarketingTest(step)).toMatchObject({ ok: false })
    expect(sendTest).toHaveBeenCalledTimes(1)
  })

  it('envía como prueba el contenido guardado sin alterar la programación', async () => {
    db.results = [
      {
        data: {
          subject: 'Hola',
          preview_text: 'Adelanto',
          body_markdown: 'Contenido',
          sequence: { deleted_at: null },
        },
      },
    ]
    expect(await sendSavedEmailMarketingTest({ id })).toEqual({
      ok: true,
      email: 'ana@example.test',
    })
    expect(sendTest).toHaveBeenCalledWith(
      { subject: 'Hola', previewText: 'Adelanto', bodyMarkdown: 'Contenido' },
      expect.objectContaining({ email: 'ana@example.test' }),
    )
    expect(
      db.calls.some((call) => ['insert', 'upsert', 'update', 'delete'].includes(call.method)),
    ).toBe(false)
  })

  it('no envía pruebas si el email no existe, la secuencia se eliminó o no hay permiso', async () => {
    db.results = [{ data: null }, { data: { sequence: { deleted_at: '2026-01-01' } } }]
    expect(await sendSavedEmailMarketingTest({ id })).toMatchObject({ ok: false })
    expect(await sendSavedEmailMarketingTest({ id })).toMatchObject({ ok: false })
    role.value = 'viewer'
    expect(await sendSavedEmailMarketingTest({ id })).toMatchObject({ ok: false })
    expect(sendTest).not.toHaveBeenCalled()
  })
  it('da de baja globalmente sin eliminar el contacto ni sus pertenencias', async () => {
    db.results = [{ data: { id } }]
    expect(await unsubscribeMarketingContact({ id })).toEqual({ ok: true })
    expect(db.calls).toContainEqual(
      expect.objectContaining({
        table: 'email_marketing_contacts',
        method: 'update',
        args: [
          expect.objectContaining({ status: 'unsubscribed', unsubscribed_at: expect.any(String) }),
        ],
      }),
    )
    expect(db.calls.some((call) => call.method === 'delete')).toBe(false)
  })
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
    db.results = [{ data: { email: 'ana@example.test', status: 'subscribed' } }, { data: { id } }]
    expect(
      await updateEmailMarketingContact({
        id,
        email: 'ana@example.test',
        name: 'Ana',
        company: 'Empresa',
      }),
    ).toEqual({
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

  it('cambia el email normalizado con consentimiento y sin modificar el estado', async () => {
    db.results = [{ data: { email: 'ana@example.test', status: 'subscribed' } }, { data: { id } }]
    expect(
      await updateEmailMarketingContact({
        id,
        email: ' Nueva@Example.test ',
        name: 'Ana',
        confirmEmailConsent: 'on',
      }),
    ).toEqual({ ok: true })
    expect(db.calls).toContainEqual(
      expect.objectContaining({
        method: 'update',
        args: [{ name: 'Ana', company: null, email: 'nueva@example.test' }],
      }),
    )
    expect(db.calls).toContainEqual(
      expect.objectContaining({ method: 'eq', args: ['email', 'ana@example.test'] }),
    )
    expect(db.calls).toContainEqual(
      expect.objectContaining({ method: 'eq', args: ['status', 'subscribed'] }),
    )
  })

  it('no cambia el email sin consentimiento, ni el de un contacto bloqueado', async () => {
    db.results = [{ data: { email: 'ana@example.test', status: 'subscribed' } }]
    expect(await updateEmailMarketingContact({ id, email: 'nueva@example.test' })).toMatchObject({
      ok: false,
      error: expect.stringContaining('autoriza'),
    })
    db.results = [{ data: { email: 'ana@example.test', status: 'unsubscribed' } }]
    expect(
      await updateEmailMarketingContact({
        id,
        email: 'nueva@example.test',
        confirmEmailConsent: 'on',
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('baja') })
    expect(db.calls.some((call) => call.method === 'update')).toBe(false)
  })

  it('rechaza emails inválidos y duplicados sin reactivar contactos existentes', async () => {
    expect(
      await updateEmailMarketingContact({ id, email: 'incorrecto', confirmEmailConsent: 'on' }),
    ).toMatchObject({ ok: false })
    expect(db.calls).toHaveLength(0)
    db.results = [
      { data: { email: 'ana@example.test', status: 'subscribed' } },
      { error: { code: '23505', message: 'duplicate' } },
    ]
    expect(
      await updateEmailMarketingContact({
        id,
        email: 'nueva@example.test',
        confirmEmailConsent: 'on',
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining('Ya existe un contacto') })
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

  it('rechaza fechas inexistentes antes de programar', async () => {
    const result = await addEmailMarketingStep({
      sequenceId: id,
      title: 'Correo',
      subject: 'Hola',
      bodyMarkdown: 'Contenido',
      scheduledAt: '2099-02-31T10:00',
    })
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('fecha') })
    expect(db.calls).toHaveLength(0)
  })

  it('no envía sin confirmación o con la secuencia pausada', async () => {
    expect(await sendEmailMarketingStepNow({ id, confirm: false } as never)).toMatchObject({
      ok: false,
    })
    db.results = [
      {
        data: {
          id,
          status: 'scheduled',
          tracking_campaign_id: null,
          sequence: { status: 'paused', deleted_at: null },
        },
      },
    ]
    expect(await sendEmailMarketingStepNow({ id, confirm: true })).toMatchObject({
      ok: false,
      error: expect.stringContaining('Activa'),
    })
    expect(processor).not.toHaveBeenCalled()
    expect(db.calls.some((call) => call.method === 'update')).toBe(false)
  })

  it('inicia únicamente el email confirmado y no lo duplica si falla el procesador', async () => {
    const step = {
      id,
      status: 'scheduled',
      tracking_campaign_id: null,
      sequence: { status: 'active', deleted_at: null },
    }
    db.results = [{ data: step }, { data: { id } }]
    expect(await sendEmailMarketingStepNow({ id, confirm: true })).toEqual({
      ok: true,
      outcome: 'started',
    })
    expect(processor).toHaveBeenCalledWith({ stepId: id })
    expect(db.calls).toContainEqual(
      expect.objectContaining({ method: 'is', args: ['tracking_campaign_id', null] }),
    )
    db.results = [{ data: step }, { data: { id } }]
    processor.mockRejectedValueOnce(new Error('offline'))
    expect(await sendEmailMarketingStepNow({ id, confirm: true })).toEqual({
      ok: true,
      outcome: 'queued',
    })
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
