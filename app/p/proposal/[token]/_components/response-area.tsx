import { CircleCheck as CheckCircle2, Clock, FileText, Mail, XCircle } from 'lucide-react'

import { ProposalPaymentOptions } from '@/components/portal/proposal-payment-options'
import { formatPortalDate, formatPortalEUR } from '@/lib/portal/language'

import { type PortalLanguage, makeTr } from '../_lib/i18n'

type ConfirmedPayment = { id: string; amount: number }

/**
 * Shown once the client has answered: answer date, then either the payment
 * options (accepted, deposit pending) or the deposit receipt (paid).
 */
export function ResponseArea({
  token,
  language,
  status,
  isTeam,
  respondedAt,
  proposalId,
  proposalNumber,
  signalPaid,
  firstPayment,
  depositAmount,
  initialPaymentPercentage,
  companyName,
  iban,
  expired,
  contactEmail,
}: {
  token: string
  language: PortalLanguage
  status: string
  isTeam: boolean
  /** Not answered, but past its validity date: no longer acceptable. */
  expired: boolean
  /** Where a declined or expired lead can ask for a new version. */
  contactEmail: string | null
  respondedAt: string | null
  proposalId: string
  proposalNumber: string
  signalPaid: boolean
  firstPayment: ConfirmedPayment | undefined
  depositAmount: number | null
  initialPaymentPercentage: number | null
  companyName: string | null
  iban: string | null
}) {
  const tr = makeTr(language)
  const accepted = status === 'accepted'
  const rejected = status === 'rejected'

  const banner = accepted
    ? {
        Icon: CheckCircle2,
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-200',
        title: tr(
          '¡Propuesta aceptada! Gracias por confiar en nosotros',
          'Proposta acceptada! Gràcies per confiar en nosaltres',
          'Proposal accepted! Thank you for trusting us',
        ),
        body: signalPaid
          ? tr(
              'Hemos recibido tu primer pago. Te escribiremos en breve con el calendario de inicio.',
              'Hem rebut el teu primer pagament. T’escriurem aviat amb el calendari d’inici.',
              'We received your first payment. We will write to you shortly with the start schedule.',
            )
          : depositAmount !== null
            ? tr(
                'Último paso: abona la señal para que podamos poner el proyecto en marcha.',
                'Últim pas: abona la bestreta perquè puguem posar el projecte en marxa.',
                'Last step: pay the deposit so we can get the project underway.',
              )
            : tr(
                'Te escribiremos en breve con los siguientes pasos.',
                'T’escriurem aviat amb els propers passos.',
                'We will write to you shortly with the next steps.',
              ),
      }
    : {
        Icon: rejected ? XCircle : Clock,
        tone: 'border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
        title: rejected
          ? tr(
              'Has rechazado esta propuesta',
              'Has rebutjat aquesta proposta',
              'You declined this proposal',
            )
          : tr(
              'Esta propuesta ha caducado',
              'Aquesta proposta ha caducat',
              'This proposal has expired',
            ),
        body: rejected
          ? tr(
              'Si cambian las circunstancias o quieres ajustar el alcance o el precio, preparamos una nueva versión.',
              'Si canvien les circumstàncies o vols ajustar l’abast o el preu, preparem una nova versió.',
              'If things change or you want to adjust scope or price, we can prepare a new version.',
            )
          : tr(
              'Los precios y plazos pueden haber cambiado. Pídenos una versión actualizada y te la enviamos.',
              'Els preus i terminis poden haver canviat. Demana’ns una versió actualitzada i te l’enviem.',
              'Prices and timelines may have changed. Ask us for an updated version and we will send it.',
            ),
      }
  const BannerIcon = banner.Icon
  const newVersionHref = contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent(`${tr('Nueva versión de la propuesta', 'Nova versió de la proposta', 'New version of proposal')} ${proposalNumber}`)}`
    : null

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div
        className={`flex w-full max-w-xl flex-col items-center gap-2 rounded-xl border px-5 py-5 text-center ${banner.tone}`}
      >
        <BannerIcon aria-hidden className="size-6" />
        <p className="text-base font-semibold">{banner.title}</p>
        <p className="text-sm opacity-90">{banner.body}</p>
        {!accepted && newVersionHref ? (
          <a
            href={newVersionHref}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#2A4227] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1f3320]"
          >
            <Mail aria-hidden className="size-3.5" />
            {tr('Pedir una nueva versión', 'Demanar una nova versió', 'Ask for a new version')}
          </a>
        ) : null}
        {accepted ? (
          <a
            href={`/p/proposal/${token}/pdf?lang=${language}`}
            className="mt-1 text-xs font-medium underline underline-offset-4"
          >
            {tr('Descargar copia en PDF', 'Descarregar còpia en PDF', 'Download a PDF copy')}
          </a>
        ) : null}
      </div>
      {respondedAt && !expired ? (
        <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
          {tr('Respondida el ', 'Resposta el ', 'Answered on ')}
          {formatPortalDate(respondedAt, language)}.
        </p>
      ) : null}

      {accepted && !signalPaid && !isTeam && depositAmount !== null ? (
        <ProposalPaymentOptions
          proposalId={proposalId}
          token={token}
          proposalNumber={proposalNumber}
          initialPaymentPercentage={initialPaymentPercentage ?? 0}
          depositAmount={depositAmount}
          companyName={companyName}
          iban={iban}
          language={language}
        />
      ) : null}

      {accepted && signalPaid && firstPayment ? (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 dark:border-emerald-800/50 dark:bg-emerald-950/20">
            <CheckCircle2 aria-hidden className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
              {tr('Primer pago abonado', 'Primer pagament abonat', 'First payment received')} (
              {formatPortalEUR(firstPayment.amount, language)})
            </span>
          </div>
          <a
            href={`/p/proposal/${token}/receipt/${firstPayment.id}?lang=${language}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-[#2A4227] hover:underline dark:text-[#9CC196]"
          >
            <FileText aria-hidden className="size-3.5" />
            {tr(
              'Ver justificante de pago',
              'Veure el justificant de pagament',
              'View payment receipt',
            )}
          </a>
        </div>
      ) : null}
    </div>
  )
}
