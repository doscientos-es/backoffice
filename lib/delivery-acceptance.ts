import { createHash } from 'node:crypto'

export type DeliveryAcceptanceMode = 'explicit_only' | 'explicit_or_uncontested'

export type DeliveryAcceptanceSettings = {
  enabled: boolean
  days: number
  mode: DeliveryAcceptanceMode
}

export const DEFAULT_DELIVERY_ACCEPTANCE_SETTINGS: DeliveryAcceptanceSettings = {
  enabled: false,
  days: 7,
  mode: 'explicit_or_uncontested',
}

export function deliveryAcceptanceClause(settings: DeliveryAcceptanceSettings): string {
  if (!settings.enabled) return ''
  const days = Math.max(1, Math.min(30, Math.round(settings.days)))
  const reviewRule = settings.mode === 'explicit_only'
    ? 'La aceptación deberá realizarse expresamente mediante firma electrónica.'
    : `Si el Cliente profesional no firma el acta ni comunica una no conformidad concreta y verificable dentro de ese plazo, se registrará la “conformidad no impugnada en plazo”, sin crear ni atribuir al Cliente una firma que no haya realizado.`

  return `17. **Acta de entrega y conformidad.** Cuando esta opción esté activada, Doscientos pondrá a disposición del Cliente un acta con el detalle de los entregables y los criterios de aceptación. El Cliente dispondrá de ${days} días naturales para revisarla y aceptar el trabajo o comunicar por escrito una no conformidad concreta y verificable. ${reviewRule} La falta de objeción no limita los derechos imperativos de consumidores y usuarios ni impide comunicar defectos ocultos. Las incidencias no controvertidas no suspenden el pago de las partes ya entregadas o aceptadas.`
}

export function deliveryAcceptanceSnapshot(input: Record<string, unknown>) {
  return {
    version: 'doscientos-delivery-acceptance-v1',
    ...input,
  }
}

export function deliveryAcceptanceHash(snapshot: unknown): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

export function deliveryAcceptanceDeadline(sentAt: Date, days: number): Date {
  const deadline = new Date(sentAt)
  deadline.setUTCDate(deadline.getUTCDate() + Math.max(1, Math.min(30, Math.round(days))))
  return deadline
}
