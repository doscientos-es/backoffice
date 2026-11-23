import { CalendarDays, Clock, Download, Presentation } from 'lucide-react'

import { formatPortalDate } from '@/lib/portal/language'

import { makeTr, type PortalCopy, type PortalLanguage } from '../_lib/i18n'
import { presentationUrl } from '../_lib/presentation'
import { StatusPill } from './primitives'

const headerActionClass =
  'inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 shadow-sm ring-1 ring-black/5 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-950'

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
    <header className="px-2 pt-8 pb-4 text-center text-zinc-950 sm:px-8 sm:pt-12 sm:pb-6">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <p className="text-xs font-semibold tracking-wide text-zinc-700 sm:text-sm">
          {copy.proposal} · {proposalNumber}
        </p>
        <StatusPill status={status} label={statusLabel} />
      </div>
      <h1 className="mx-auto mt-6 max-w-3xl text-3xl leading-[1.1] font-semibold tracking-tight break-words sm:text-5xl">
        {title}
      </h1>
      <div className="mt-6 flex flex-col items-center justify-center gap-5">
        {validUntil ? (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-sm text-zinc-700">
            <CalendarDays aria-hidden className="size-4" />
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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href={`/p/proposal/${token}/pdf?lang=${language}`} className={headerActionClass}>
            <Download className="size-3.5" aria-hidden />
            {copy.download}
          </a>
          <a href={presentationUrl(token, language)} className={headerActionClass}>
            <Presentation className="size-3.5" aria-hidden />
            {tr('Ver presentación', 'Veure presentació', 'View presentation')}
          </a>
        </div>
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
    <div className="flex items-center justify-center gap-4 px-6 py-6 sm:px-8">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#BDFF7B] text-lg font-semibold text-zinc-950">
        {logoUrl ? (
          // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
          <img src={logoUrl} alt={`Logo ${name}`} className="size-full object-contain p-1.5" />
        ) : (
          <span aria-hidden>{name.trim().slice(0, 1).toUpperCase()}</span>
        )}
      </div>
      <div className="min-w-0 text-left">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-0.5 text-base leading-snug font-semibold break-words text-zinc-900">
          {name}
        </p>
      </div>
    </div>
  )
}
