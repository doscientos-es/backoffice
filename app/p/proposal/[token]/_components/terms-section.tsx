import { FileText } from 'lucide-react'

import { Markdown } from '@/components/ui/markdown'
import type { PaymentSchedule } from '@/lib/proposals/scope'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import type { ProposalSpec } from '../_lib/types'
import { SectionLabel } from './primitives'

function paymentScheduleLabel(tr: Tr, schedule: PaymentSchedule): string {
  const labels: Record<PaymentSchedule, string> = {
    upfront: tr('100 % al aceptar', '100 % en acceptar', '100% on acceptance'),
    half_half: tr(
      '50 % al aceptar · 50 % a la entrega',
      '50 % en acceptar · 50 % en el lliurament',
      '50% on acceptance · 50% on delivery',
    ),
    '30_40_30': tr(
      '30 % al aceptar · 40 % durante el proyecto · 30 % a la entrega',
      '30 % en acceptar · 40 % durant el projecte · 30 % en el lliurament',
      '30% on acceptance · 40% during the project · 30% on delivery',
    ),
    per_module_upfront: tr(
      'Pago adelantado por módulo',
      'Pagament avançat per mòdul',
      'Upfront payment per module',
    ),
    custom: tr('Personalizado', 'Personalitzat', 'Custom'),
  }
  return labels[schedule]
}

export function TermsSection({
  paymentTerms,
  paymentSchedule,
  changeManagementTerms,
  tr,
}: {
  paymentTerms: string | null
  paymentSchedule: PaymentSchedule
  changeManagementTerms: string | null
  tr: Tr
}) {
  if (!paymentTerms && !changeManagementTerms) return null
  return (
    <div className="border-t border-zinc-100 bg-zinc-50 px-8 py-6 dark:border-zinc-800/60 dark:bg-zinc-900/50">
      <SectionLabel as="p" className="mb-4">
        {tr('Condiciones', 'Condicions', 'Terms')}
      </SectionLabel>
      <div className="grid gap-5 lg:grid-cols-2">
        {paymentTerms ? (
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {tr('Forma de pago', 'Forma de pagament', 'Payment method')}
            </p>
            <p className="mt-1 text-xs font-medium text-[#2A4227] dark:text-[#9CC196]">
              {paymentScheduleLabel(tr, paymentSchedule)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {paymentTerms}
            </p>
          </div>
        ) : null}
        {changeManagementTerms ? (
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {tr('Cambios de alcance', 'Canvis d’abast', 'Scope changes')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {changeManagementTerms}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function NotesSection({ notes, tr }: { notes: string | null; tr: Tr }) {
  if (!notes) return null
  return (
    <div className="border-t border-zinc-100 bg-zinc-50 px-8 py-5 dark:border-zinc-800/60 dark:bg-zinc-900/50">
      <SectionLabel as="p" className="mb-2">
        {tr('Notas', 'Notes', 'Notes')}
      </SectionLabel>
      <Markdown source={notes} className="text-zinc-700 dark:text-zinc-300" />
    </div>
  )
}

export function SpecsSection({
  specs,
  language,
  tr,
}: {
  specs: ProposalSpec[]
  language: PortalLanguage
  tr: Tr
}) {
  if (specs.length === 0) return null
  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 px-8 py-6 dark:border-zinc-800">
      <SectionLabel as="p">
        {tr('Documentación técnica', 'Documentació tècnica', 'Technical documentation')}
      </SectionLabel>
      <ul className="flex flex-col gap-2">
        {specs.map((spec) => (
          <li key={spec.id}>
            <a
              href={`/p/spec/${spec.portal_token}?lang=${language}`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 transition-colors hover:border-[#2A4227] hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/50"
            >
              <FileText aria-hidden className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              <span className="flex-1 truncate font-medium">{spec.title}</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {tr('Abrir', 'Obrir', 'Open')} →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
