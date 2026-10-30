import { CircleCheck as CheckCircle2, FileText } from 'lucide-react'

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
}: {
  token: string
  language: PortalLanguage
  status: string
  isTeam: boolean
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

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
        {tr('Respondida el ', 'Resposta el ', 'Answered on ')}
        {formatPortalDate(respondedAt, language)}.
      </p>

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
