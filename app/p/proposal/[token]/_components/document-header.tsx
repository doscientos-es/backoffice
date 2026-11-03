import { Clock, Download } from 'lucide-react'

import { formatPortalDate } from '@/lib/portal/language'

import { makeTr, type PortalCopy, type PortalLanguage } from '../_lib/i18n'
import { StatusPill } from './primitives'

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
    <header className="px-6 py-10 text-center text-zinc-950 sm:px-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-sm font-medium">
          {copy.proposal} · {proposalNumber}
        </p>
        <StatusPill status={status} label={statusLabel} />
      </div>
      <h1 className="mx-auto mt-7 max-w-3xl text-3xl leading-[1.08] font-semibold tracking-tight break-words sm:text-5xl lg:text-6xl">
        {title}
      </h1>
      <div className="mt-7 flex flex-col items-center justify-center gap-5">
        {validUntil ? (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm text-zinc-800">
            <span>
              {copy.validUntil}{' '}
              <strong className="font-semibold text-zinc-950">
                {formatPortalDate(validUntil, language)}
              </strong>
            </span>
            {countdown ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${urgent ? 'bg-zinc-950 text-white' : 'bg-white/70 text-zinc-950'}`}
              >
                <Clock aria-hidden className="size-3" />
                {countdown}
              </span>
            ) : null}
          </p>
        ) : null}
        <a
          href={`/p/proposal/${token}/pdf?lang=${language}`}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950"
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
    <div className="flex items-center justify-center gap-3 px-6 pt-8">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#BDFF7B] text-lg font-semibold text-zinc-950">
        {logoUrl ? (
          // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
          <img src={logoUrl} alt={`Logo ${name}`} className="size-full object-contain p-1.5" />
        ) : (
          <span aria-hidden>{name.trim().slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
        <p className="text-sm font-semibold break-words text-zinc-900 dark:text-zinc-100">{name}</p>
      </div>
    </div>
  )
}
