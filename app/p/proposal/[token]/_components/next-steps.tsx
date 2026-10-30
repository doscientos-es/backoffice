import { formatPortalEUR } from '@/lib/portal/language'

import type { PortalLanguage, Tr } from '../_lib/i18n'
import { SectionLabel } from './primitives'

/** "What happens when I accept" in three plain steps, to lower the fear of the unknown. */
export function NextSteps({
  language,
  tr,
  needsFiscal,
  depositAmount,
}: {
  language: PortalLanguage
  tr: Tr
  needsFiscal: boolean
  depositAmount: number | null
}) {
  const steps = [
    {
      title: tr('Firmas la propuesta', 'Signes la proposta', 'You sign the proposal'),
      body: needsFiscal
        ? tr(
            'Escribes tu nombre y tus datos de facturación. Recibes una copia por email.',
            'Escrius el teu nom i les teves dades de facturació. Reps una còpia per correu.',
            'You enter your name and billing details. You get a copy by email.',
          )
        : tr(
            'Escribes tu nombre y confirmas las condiciones. Recibes una copia por email.',
            'Escrius el teu nom i confirmes les condicions. Reps una còpia per correu.',
            'You enter your name and confirm the terms. You get a copy by email.',
          ),
    },
    {
      title:
        depositAmount !== null
          ? tr(
              `Abonas la señal (${formatPortalEUR(depositAmount, language)})`,
              `Abones la bestreta (${formatPortalEUR(depositAmount, language)})`,
              `You pay the deposit (${formatPortalEUR(depositAmount, language)})`,
            )
          : tr(
              'Acordamos el primer pago',
              'Acordem el primer pagament',
              'We agree the first payment',
            ),
      body:
        depositAmount !== null
          ? tr(
              'Tras firmar eliges cómo pagarla y te enviamos el justificante.',
              'Després de signar tries com pagar-la i t’enviem el justificant.',
              'After signing you choose how to pay and we send you the receipt.',
            )
          : tr(
              'Te indicamos cómo y cuándo según las condiciones de pago.',
              'T’indiquem com i quan segons les condicions de pagament.',
              'We tell you how and when, following the payment terms.',
            ),
    },
    {
      title: tr('Arrancamos', 'Arrenquem', 'We get started'),
      body: tr(
        'Te confirmamos por email el calendario de inicio y quién será tu contacto.',
        'Et confirmem per correu el calendari d’inici i qui serà el teu contacte.',
        'We confirm the start schedule by email, and who your contact will be.',
      ),
    },
  ]

  return (
    <div
      id="siguientes-pasos"
      className="scroll-mt-16 border-t border-zinc-200 px-6 py-6 sm:px-8 dark:border-zinc-800"
    >
      <SectionLabel as="h2" className="mb-4">
        {tr('Qué ocurre al aceptar', 'Què passa en acceptar', 'What happens when you accept')}
      </SectionLabel>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2A4227] text-xs font-bold text-white dark:bg-[#9CC196] dark:text-zinc-900"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
