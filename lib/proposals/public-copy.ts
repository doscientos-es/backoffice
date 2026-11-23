import type { PortalLanguage } from '@/lib/portal/language'

import { PAYMENT_SCHEDULE_LABELS, type PaymentSchedule, type ScopeModule } from './scope'

export function proposalTr(language: PortalLanguage) {
  return (es: string, ca: string, en: string) =>
    language === 'ca' ? ca : language === 'en' ? en : es
}

export function publicPaymentScheduleLabel(
  schedule: PaymentSchedule,
  language: PortalLanguage,
): string {
  if (language === 'es') return PAYMENT_SCHEDULE_LABELS[schedule]
  const labels: Record<Exclude<PortalLanguage, 'es'>, Record<PaymentSchedule, string>> = {
    ca: {
      upfront: '100 % en acceptar',
      half_half: '50 % en acceptar · 50 % en el lliurament',
      '30_40_30': '30 % en acceptar · 40 % durant el projecte · 30 % en el lliurament',
      per_module_upfront: 'Pagament avançat per mòdul',
      custom: 'Personalitzat',
    },
    en: {
      upfront: '100 % on acceptance',
      half_half: '50 % on acceptance · 50 % on delivery',
      '30_40_30': '30 % on acceptance · 40 % during the project · 30 % on delivery',
      per_module_upfront: 'Payment in advance per module',
      custom: 'Custom',
    },
  }
  return labels[language][schedule]
}

export function publicScopeDuration(module: ScopeModule, language: PortalLanguage): string | null {
  if (module.duration_mode === 'custom') {
    const value = module.duration_custom
    if (!value || language === 'es') return value ?? null
    const match = /^(\d+)\s+(días?|semanas?|mes|meses)$/.exec(value)
    if (!match?.[1] || !match[2]) return value
    const units = match[2].startsWith('día')
      ? ['dia', 'dies', 'day', 'days']
      : match[2].startsWith('semana')
        ? ['setmana', 'setmanes', 'week', 'weeks']
        : ['mes', 'mesos', 'month', 'months']
    const plural = Number(match[1]) !== 1
    return `${match[1]} ${units[(language === 'en' ? 2 : 0) + (plural ? 1 : 0)]}`
  }
  if (!module.duration_weeks) return null
  const tr = proposalTr(language)
  const weeks = module.duration_weeks
  return `${weeks} ${weeks === 1 ? tr('semana', 'setmana', 'week') : tr('semanas', 'setmanes', 'weeks')}`
}
