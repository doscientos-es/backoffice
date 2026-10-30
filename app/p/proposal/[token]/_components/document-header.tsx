import { Clock, Download } from 'lucide-react'

import { formatPortalDate } from '@/lib/portal/language'

import { makeTr, type PortalCopy, type PortalLanguage } from '../_lib/i18n'
import { SectionLabel, StatusPill } from './primitives'

export function DocumentHeader({
  token,
  language,
  copy,
  proposalNumber,
  title,
  validUntil,
  daysLeft,
  status,
  statusLabel,
}: {
  token: string
  language: PortalLanguage
  copy: PortalCopy
  proposalNumber: string
  title: string
  validUntil: string | null
  /** Days until `validUntil` (see `daysUntilExpiry`); null when there is no deadline. */
  daysLeft: number | null
  status: string
  statusLabel: string
}) {
  const tr = makeTr(language)
  const pending = status !== 'accepted' && status !== 'rejected' && status !== 'expired'
  // Only urgent when the date is real and close; never shown once answered.
  const countdown =
    pending && daysLeft !== null && daysLeft >= 0 && daysLeft <= 7
      ? daysLeft === 0
        ? tr('Último día para aceptar', 'Últim dia per acceptar', 'Last day to accept')
        : daysLeft === 1
          ? tr('Queda 1 día', 'Queda 1 dia', '1 day left')
          : tr(`Quedan ${daysLeft} días`, `Queden ${daysLeft} dies`, `${daysLeft} days left`)
      : null
  const urgent = daysLeft !== null && daysLeft <= 2
  return (
    <header className="border-b border-zinc-200 px-6 py-6 sm:px-8 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <SectionLabel as="p">
            {copy.proposal} · {proposalNumber}
          </SectionLabel>
        </div>
        <StatusPill status={status} label={statusLabel} />
      </div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-100">
            {title}
          </h1>
          {validUntil ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <span>
                {copy.validUntil}{' '}
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {formatPortalDate(validUntil, language)}
                </strong>
              </span>
              {countdown ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${urgent ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300' : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}
                >
                  <Clock aria-hidden className="size-3" />
                  {countdown}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <a
          href={`/p/proposal/${token}/pdf?lang=${language}`}
          className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#2A4227] transition-colors hover:border-[#2A4227] hover:bg-[#2A4227]/5 dark:border-zinc-700 dark:bg-zinc-900 dark:text-[#9CC196] dark:hover:border-[#9CC196]"
        >
          <Download className="size-3.5" />
          {copy.download}
        </a>
      </div>
    </header>
  )
}

export function RecipientBlock({
  label,
  name,
  logoUrl,
}: {
  label: string
  name: string
  logoUrl: string | null
}) {
  return (
    <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-5 sm:px-8 dark:border-zinc-800/60 dark:bg-zinc-900/50">
      <SectionLabel as="p" className="mb-2">
        {label}
      </SectionLabel>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
          <img src={logoUrl} alt={`Logo ${name}`} className="size-8 rounded object-contain" />
        ) : null}
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</p>
      </div>
    </div>
  )
}
