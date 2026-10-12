import type { EntityAuditTimelineEvent } from './types'

const AUDIT_FIELD_LABELS: Record<string, string> = {
  alias: 'alias',
  ai_confidence: 'confianza IA',
  ai_summary: 'resumen IA',
  ai_suggested_next_step: 'siguiente paso IA',
  ai_suggested_next_step_at: 'fecha sugerida IA',
  ai_tags: 'etiquetas IA',
  ai_temperature: 'temperatura IA',
  company: 'empresa',
  company_research: 'investigación de empresa',
  company_size: 'tamaño de empresa',
  conversion_step: 'paso de conversión',
  email: 'email',
  estimated_value: 'valor estimado',
  first_landing_path: 'primera página de aterrizaje',
  first_referrer: 'primer referente',
  first_utm_campaign: 'primera campaña',
  first_utm_content: 'primer contenido UTM',
  first_utm_medium: 'primer medio UTM',
  first_utm_source: 'primera fuente UTM',
  first_utm_term: 'primer término UTM',
  landing_path: 'página de aterrizaje',
  language: 'idioma',
  last_landing_path: 'última página de aterrizaje',
  last_referrer: 'último referente',
  last_utm_campaign: 'última campaña',
  last_utm_content: 'último contenido UTM',
  last_utm_medium: 'último medio UTM',
  last_utm_source: 'última fuente UTM',
  last_utm_term: 'último término UTM',
  marketing_consent: 'consentimiento de marketing',
  name: 'nombre',
  notes: 'notas',
  phone: 'teléfono',
  score: 'puntuación',
  solution_type: 'tipo de solución',
  source: 'origen',
  urgency: 'urgencia',
  utm_campaign: 'campaña UTM',
}

export function describeAuditEvent(event: EntityAuditTimelineEvent) {
  const fields = [...new Set(event.changedFields)].map(
    (field) => AUDIT_FIELD_LABELS[field] ?? field.replaceAll('_', ' '),
  )
  const isAiUpdate = event.changedFields.some(
    (field) => field.startsWith('ai_') || field === 'company_research',
  )

  return {
    title: isAiUpdate ? 'Información asistida por IA actualizada' : 'Ficha actualizada',
    detail: fields.join(' · '),
    actor: event.actorName?.trim() || (event.origin === 'system' ? 'Automatización' : 'Equipo'),
  }
}
