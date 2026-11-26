import { createHash, timingSafeEqual } from 'node:crypto'

import { z } from 'zod'

import { MENOSLIOS_LEAD_SOURCE } from '@/lib/leads/constants'

const booking = z
  .object({
    start: z.string().datetime({ offset: true }),
    seats: z.number().int().min(1).max(200),
    interval: z.enum(['month', 'year']),
    modules: z.array(z.enum(['ai', 'procurement', 'workers'])).max(3),
  })
  .strict()

export const menosliosPayload = z
  .object({
    tenantId: z.string().uuid(),
    company: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    email: z.string().trim().email().max(254),
  })
  .and(
    z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('registration'), booking: z.null() }),
      z.object({ kind: z.literal('booking'), booking }),
    ]),
  )

export type MenosliosPayload = z.infer<typeof menosliosPayload>
const moduleNames = { ai: 'IA', procurement: 'Proveedores', workers: 'Trabajadores' }

const hash = (s: string) => createHash('sha256').update(s).digest()

export function hasMenosliosAuthorization(authorization: string | null, secret: string) {
  return (
    secret.length >= 32 &&
    authorization !== null &&
    timingSafeEqual(hash(authorization), hash(`Bearer ${secret}`))
  )
}

export function menosliosIntake(payload: MenosliosPayload) {
  return {
    name: payload.name,
    email: payload.email.toLowerCase(),
    company: payload.company,
    source: MENOSLIOS_LEAD_SOURCE,
    externalSource: 'menoslios',
    externalId: payload.tenantId,
    exactIdentityOnly: true,
    notes: 'Alta de empresa en Menoslios (antes Ábaco). Origen: registro en el producto.',
  }
}

const safeText = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\r\n\u2028\u2029]+/g, ' ')

export function menosliosBookingContext(
  payload: Extract<MenosliosPayload, { kind: 'booking' }>,
  leadId: string,
  appUrl: string,
) {
  const { booking: b } = payload
  const facts = [
    `Empresa: ${payload.company}`,
    `Contacto: ${payload.name} (${payload.email})`,
    `Plazas: ${b.seats}`,
    `Suscripción: ${b.interval === 'year' ? 'anual' : 'mensual'}`,
    `Módulos adicionales: ${[...new Set(b.modules)].map((m) => moduleNames[m]).join(', ') || 'ninguno'}`,
    `Ficha del lead: ${new URL(`/leads/${leadId}`, appUrl).href}`,
    'Objetivo: parametrizar la empresa y preparar la importación de Excel o CSV.',
  ]
  const start = new Date(b.start)
  // Stable across retries, without including personal data in the identifier.
  const key = hash(`menoslios:booking:${payload.tenantId}:${start.toISOString()}`).toString('hex')
  return {
    start,
    end: new Date(start.valueOf() + 30 * 60_000),
    summary: `[Menoslios · Contexto interno] ${payload.company.replace(/\s+/g, ' ')}`,
    description: facts.map(safeText).join('<br>'),
    note: facts.join('\n'),
    idempotency: { eventId: `menoslios${key}`, fingerprint: key },
    interactionId: `${key.slice(0, 8)}-${key.slice(8, 12)}-4${key.slice(13, 16)}-8${key.slice(17, 20)}-${key.slice(20, 32)}`,
  }
}
