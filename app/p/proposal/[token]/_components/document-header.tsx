import { Download } from 'lucide-react'

import { formatPortalDate } from '@/lib/portal/language'

import type { PortalCopy, PortalLanguage } from '../_lib/i18n'
import { SectionLabel, StatusPill } from './primitives'

export function DocumentHeader({
  token,
  language,
  copy,
  proposalNumber,
  title,
  validUntil,
  status,
  statusLabel,
}: {
  token: string
  language: PortalLanguage
  copy: PortalCopy
  proposalNumber: string
  title: string
  validUntil: string | null
  status: string
  statusLabel: string
}) {
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
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {copy.validUntil}{' '}
              <strong className="text-zinc-700 dark:text-zinc-300">
                {formatPortalDate(validUntil, language)}
              </strong>
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
