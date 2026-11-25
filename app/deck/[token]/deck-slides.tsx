import { ArrowRight, Download } from 'lucide-react'
import { createContext, type ReactNode, useContext } from 'react'

import { LogoMark } from '@/components/branding'
import { TimelineChart } from '@/components/proposals/timeline-chart'
import { Markdown } from '@/components/ui/markdown'
import { type BillingCycle, computeProposalTotals, type ProposalTotals } from '@/lib/finance'
import { formatPortalDate, formatPortalEUR, type PortalLanguage } from '@/lib/portal/language'
import type { KeyPoint } from '@/lib/proposals/key-points'
import {
  proposalTr,
  publicPaymentScheduleLabel,
  publicScopeDuration,
} from '@/lib/proposals/public-copy'
import type { ScopeModule } from '@/lib/proposals/scope'
import { timelineLayout } from '@/lib/proposals/timeline'

import type { DeckProposal, DeckProposalItem, DeckTeamMember } from './page'

const LanguageContext = createContext<PortalLanguage>('es')

function buildTotals(items: DeckProposalItem[], proposal: DeckProposal): ProposalTotals {
  return computeProposalTotals(
    items.map((it) => ({
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
      billing_cycle: it.billing_cycle ?? 'none',
      discount_percent: it.discount_percent ?? 0,
    })),
    { type: proposal.discount_type, value: proposal.discount_value },
  )
}

/** Line amount after its own discount (the stored subtotal is gross). */
function netLineAmount(item: DeckProposalItem): number {
  const pct = Number(item.discount_percent ?? 0)
  return pct > 0 ? Math.round(item.subtotal * (1 - pct / 100) * 100) / 100 : item.subtotal
}

function hasRecurring(totals: ProposalTotals): boolean {
  return totals.monthly.total > 0 || totals.quarterly.total > 0 || totals.yearly.total > 0
}

export type DeckSlide = {
  key: string
  label: string
  accent: 'green' | 'white' | 'zinc'
  element: ReactNode
}

function SlideWrapper({ children, watermark }: { children: ReactNode; watermark?: string }) {
  if (!watermark) return <>{children}</>
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'contents' }}>
      {children}
      <div className="deck-watermark" aria-hidden>
        {watermark}
      </div>
    </div>
  )
}

function Stagger({
  i,
  children,
  className,
}: {
  i: number
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`deck-stagger ${className ?? ''}`} style={{ ['--i' as string]: i }}>
      {children}
    </div>
  )
}

function CoverSlide({ proposal }: { proposal: DeckProposal }) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  return (
    <div className="deck-slide bg-[#2A4227] p-6 text-center text-white sm:p-10 md:p-16 lg:p-24">
      <Stagger i={0}>
        <LogoMark size={56} variant="brand" className="mb-8 opacity-80 sm:mb-12 sm:size-[72px]" />
      </Stagger>
      <Stagger i={1}>
        <p className="mb-4 text-[10px] font-semibold tracking-[0.25em] text-white/50 uppercase sm:mb-6 sm:text-xs sm:tracking-[0.3em]">
          {tr('Propuesta', 'Proposta', 'Proposal')} {proposal.number}
        </p>
      </Stagger>
      <Stagger i={2}>
        <h1 className="mb-6 max-w-4xl text-3xl leading-[1.1] font-bold tracking-tight text-balance sm:mb-8 sm:text-5xl md:text-6xl lg:text-7xl">
          {proposal.title}
        </h1>
      </Stagger>
      {proposal.client_name && (
        <Stagger i={3}>
          <div className="flex flex-col items-center gap-3">
            {proposal.client_logo_url && (
              // biome-ignore lint/performance/noImgElement: URL externa del logo del cliente, no compatible con next/image
              <img
                src={proposal.client_logo_url}
                alt={`Logo ${proposal.client_name}`}
                className="h-10 max-w-[160px] object-contain opacity-80 brightness-0 invert sm:h-14"
              />
            )}
            <p className="px-2 text-base font-light text-white/70 sm:text-xl md:text-2xl">
              {tr('Preparado para', 'Preparat per a', 'Prepared for')}{' '}
              <span className="font-medium text-white">{proposal.client_name}</span>
            </p>
          </div>
        </Stagger>
      )}
      {proposal.valid_until && (
        <Stagger i={4}>
          <p className="mt-4 text-xs tracking-widest text-white/40 uppercase sm:mt-6 sm:text-sm">
            {tr('Válida hasta', 'Vàlida fins al', 'Valid until')}{' '}
            {formatPortalDate(proposal.valid_until, language)}
          </p>
        </Stagger>
      )}
    </div>
  )
}

function SectionSlide({
  label,
  title,
  children,
  accent = 'white',
}: {
  label: string
  title: string
  children: ReactNode
  accent?: 'white' | 'zinc'
}) {
  const bg = accent === 'zinc' ? 'bg-zinc-50' : 'bg-white'
  return (
    <div className={`deck-slide justify-center p-6 text-zinc-900 sm:p-10 md:p-16 lg:p-24 ${bg}`}>
      <Stagger i={0}>
        <p className="mb-3 text-[10px] font-semibold tracking-[0.25em] text-[#2A4227] uppercase sm:mb-4 sm:text-xs sm:tracking-[0.3em]">
          {label}
        </p>
      </Stagger>
      <Stagger i={1}>
        <h2 className="mb-8 max-w-3xl text-2xl leading-tight font-bold tracking-tight text-balance sm:mb-12 sm:text-4xl md:text-5xl lg:text-6xl">
          {title}
        </h2>
      </Stagger>
      <Stagger i={2} className="flex w-full flex-col items-center">
        {children}
      </Stagger>
    </div>
  )
}

function ContextSlide({ proposal }: { proposal: DeckProposal }) {
  const tr = proposalTr(useContext(LanguageContext))
  return (
    <SectionSlide
      label={tr('Contexto', 'Context', 'Context')}
      title={tr('Dónde estamos hoy', 'On som avui', 'Where we are today')}
    >
      <div className="w-full max-w-3xl text-left">
        <Markdown
          source={proposal.context_markdown ?? ''}
          className="deck-markdown deck-markdown-intro text-base text-zinc-700 sm:text-lg md:text-xl"
        />
      </div>
    </SectionSlide>
  )
}

/**
 * Shared list slide used for problems and solutions. Both blocks share the
 * same layout but differ in badge palette so consecutive slides feel
 * distinct: muted neutral for problems (something we observed), brand
 * green for solutions (something we do about it).
 */
function KeyPointsListSlide({
  label,
  title,
  items,
  accent,
  badgeVariant,
}: {
  label: string
  title: string
  items: KeyPoint[]
  accent?: 'white' | 'zinc'
  badgeVariant: 'muted' | 'brand'
}) {
  const badgeClass =
    badgeVariant === 'brand' ? 'bg-[#2A4227] text-white' : 'bg-zinc-200 text-zinc-700'
  return (
    <SectionSlide label={label} title={title} accent={accent}>
      <ul className="flex w-full max-w-3xl flex-col gap-4 text-left sm:gap-6">
        {items.map((kp, i) => (
          <li
            key={kp.id}
            className="deck-stagger flex items-start gap-4 sm:gap-5"
            style={{ ['--i' as string]: 3 + i }}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:h-10 sm:w-10 sm:text-sm ${badgeClass}`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 pt-1 sm:pt-1.5">
              <p className="text-base font-semibold text-balance text-zinc-900 sm:text-lg md:text-xl">
                {kp.title}
              </p>
              {kp.description ? (
                <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-zinc-500 sm:mt-1.5 sm:text-base">
                  {kp.description}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </SectionSlide>
  )
}

function CadenceBadge({ cycle }: { cycle: BillingCycle }) {
  const tr = proposalTr(useContext(LanguageContext))
  if (cycle === 'none') return null
  return (
    <span className="inline-flex items-center rounded-full bg-[#2A4227]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[#2A4227] uppercase sm:text-xs">
      {
        {
          monthly: tr('Mensual', 'Mensual', 'Monthly'),
          quarterly: tr('Trimestral', 'Trimestral', 'Quarterly'),
          yearly: tr('Anual', 'Anual', 'Yearly'),
        }[cycle]
      }
    </span>
  )
}

function ServicesSlide({ items }: { items: DeckProposalItem[] }) {
  const tr = proposalTr(useContext(LanguageContext))
  return (
    <SectionSlide
      label={tr('Servicios', 'Serveis', 'Services')}
      title={tr('Qué ofrecemos', 'Què oferim', 'What we offer')}
      accent="zinc"
    >
      <ul className="flex w-full max-w-3xl flex-col gap-4 text-left sm:gap-6">
        {items.map((item, i) => {
          const cycle: BillingCycle = item.billing_cycle ?? 'none'
          return (
            <li
              key={item.id}
              className="deck-stagger flex items-start gap-4 sm:gap-5"
              style={{ ['--i' as string]: 3 + i }}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2A4227] text-xs font-bold text-white tabular-nums sm:h-10 sm:w-10 sm:text-sm">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 pt-1 sm:pt-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-balance text-zinc-900 sm:text-lg md:text-xl">
                    {item.description}
                  </p>
                  <CadenceBadge cycle={cycle} />
                </div>
                {item.quantity !== 1 && (
                  <p className="mt-0.5 text-xs text-zinc-500 sm:mt-1 sm:text-sm">
                    {item.quantity} {tr('unidades', 'unitats', 'units')}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </SectionSlide>
  )
}

function ScopeModuleSlide({ module, index }: { module: ScopeModule; index: number }) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  const duration = publicScopeDuration(module, language)
  return (
    <SectionSlide
      label={`${tr('Alcance', 'Abast', 'Scope')} · ${String(index + 1).padStart(2, '0')}`}
      title={module.title}
      accent="zinc"
    >
      <div className="w-full max-w-3xl text-left">
        {module.description ? (
          <p className="mb-6 text-base leading-relaxed text-zinc-600 sm:text-lg">
            {module.description}
          </p>
        ) : null}
        {duration ? (
          <p className="mb-6 text-sm font-medium text-zinc-500">
            {tr('Plazo estimado', 'Termini estimat', 'Estimated duration')}: {duration}
          </p>
        ) : null}
        <div className="grid gap-6 sm:grid-cols-2">
          {module.included.length > 0 ? (
            <ScopeList
              title={tr('Incluido', 'Inclòs', 'Included')}
              items={module.included}
              tone="included"
            />
          ) : null}
          {module.excluded.length > 0 ? (
            <ScopeList
              title={tr('No incluido', 'No inclòs', 'Not included')}
              items={module.excluded}
              tone="excluded"
            />
          ) : null}
        </div>
        {module.notes ? (
          <p className="mt-6 border-t border-zinc-200 pt-4 text-sm leading-relaxed text-zinc-500">
            <strong>{tr('Notas', 'Notes', 'Notes')}:</strong> {module.notes}
          </p>
        ) : null}
      </div>
    </SectionSlide>
  )
}

function ScopeList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'included' | 'excluded'
}) {
  return (
    <div>
      <p
        className={`mb-3 text-xs font-semibold tracking-[0.2em] uppercase ${tone === 'included' ? 'text-[#2A4227]' : 'text-zinc-500'}`}
      >
        {title}
      </p>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-zinc-700 sm:text-base">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DeliverySlide({ proposal }: { proposal: DeckProposal }) {
  const tr = proposalTr(useContext(LanguageContext))
  const deliverables = proposal.deliverables?.trim()
  const acceptanceCriteria = proposal.acceptance_criteria?.trim()
  return (
    <SectionSlide
      label={tr('Entrega', 'Lliurament', 'Delivery')}
      title={tr(
        'Cómo validaremos el proyecto',
        'Com validarem el projecte',
        'How we will validate the project',
      )}
    >
      <div className="grid max-w-3xl gap-8 text-left sm:grid-cols-2">
        {deliverables ? (
          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-900">
              {tr('Entregables', 'Lliurables', 'Deliverables')}
            </p>
            <Markdown source={deliverables} className="deck-markdown text-sm text-zinc-600" />
          </div>
        ) : null}
        {acceptanceCriteria ? (
          <div>
            <p className="mb-3 text-sm font-semibold text-zinc-900">
              {tr('Criterios de aceptación', 'Criteris d’acceptació', 'Acceptance criteria')}
            </p>
            <Markdown source={acceptanceCriteria} className="deck-markdown text-sm text-zinc-600" />
          </div>
        ) : null}
      </div>
    </SectionSlide>
  )
}

function PricingTotals({
  totals,
  globalReason,
}: {
  totals: ProposalTotals
  globalReason?: string | null
}) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  const formatEUR = (value: number) => formatPortalEUR(value, language)
  const { gross, lineDiscount, globalDiscount } = totals.discounts
  const recurring = hasRecurring(totals)
  const recurringBuckets = [
    { label: tr('Mensual', 'Mensual', 'Monthly'), bucket: totals.monthly },
    { label: tr('Trimestral', 'Trimestral', 'Quarterly'), bucket: totals.quarterly },
    { label: tr('Anual', 'Anual', 'Yearly'), bucket: totals.yearly },
  ].filter(({ bucket }) => bucket.total > 0)
  return (
    <div className="flex w-full flex-col items-end gap-3">
      <div className="flex flex-col items-end gap-2">
        {recurring ? (
          <p className="text-[10px] font-semibold tracking-[0.25em] text-zinc-400 uppercase sm:text-xs">
            {tr('Inversión inicial', 'Inversió inicial', 'Initial investment')}
          </p>
        ) : null}
        {lineDiscount > 0 || globalDiscount > 0 ? (
          <div className="flex flex-col items-end gap-1 text-xs text-zinc-500 sm:text-sm">
            <div className="flex gap-6 sm:gap-12">
              <span>{tr('Importe bruto', 'Import brut', 'Gross amount')}</span>
              <span className="tabular-nums">{formatEUR(gross)}</span>
            </div>
            {lineDiscount > 0 ? (
              <div className="flex gap-6 text-emerald-700 sm:gap-12">
                <span>
                  {tr('Descuentos en partidas', 'Descomptes en partides', 'Line discounts')}
                </span>
                <span className="tabular-nums">−{formatEUR(lineDiscount)}</span>
              </div>
            ) : null}
            {globalDiscount > 0 ? (
              <div className="flex gap-6 text-emerald-700 sm:gap-12">
                <span>
                  {tr('Descuento', 'Descompte', 'Discount')}
                  {globalReason ? ` · ${globalReason}` : ''}
                </span>
                <span className="tabular-nums">−{formatEUR(globalDiscount)}</span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-baseline gap-6 text-xl font-semibold text-zinc-900 sm:gap-12 sm:text-2xl">
          <span>{tr('Importe antes de IVA', 'Import abans d’IVA', 'Amount before VAT')}</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.subtotal)}</span>
        </div>
        <div className="flex gap-6 text-xs text-zinc-500 sm:gap-12 sm:text-sm">
          <span>{tr('IVA aplicable', 'IVA aplicable', 'Applicable VAT')}</span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.taxAmount)}</span>
        </div>
        <div className="mt-1 flex gap-6 border-t border-zinc-200 pt-2 text-xs font-medium text-zinc-500 sm:gap-12 sm:text-sm">
          <span>
            {tr('Total previsto con IVA', 'Total previst amb IVA', 'Estimated total including VAT')}
          </span>
          <span className="tabular-nums">{formatEUR(totals.oneTime.total)}</span>
        </div>
      </div>

      {recurring ? (
        <div className="flex w-full flex-col items-end gap-2 border-t border-zinc-200 pt-4">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-[#2A4227] uppercase sm:text-xs">
            {tr('Mantenimiento recurrente', 'Manteniment recurrent', 'Recurring maintenance')}
          </p>
          {recurringBuckets.map(({ label, bucket }) => (
            <div key={label} className="flex flex-col items-end gap-1">
              <div className="flex gap-6 text-sm font-medium text-zinc-700 sm:gap-12 sm:text-base">
                <span>
                  {label} · {tr('antes de IVA', 'abans d’IVA', 'before VAT')}
                </span>
                <span className="tabular-nums">{formatEUR(bucket.subtotal)}</span>
              </div>
              <div className="flex gap-6 text-[10px] text-zinc-500 sm:gap-12 sm:text-xs">
                <span>
                  {tr('IVA', 'IVA', 'VAT')} {formatEUR(bucket.taxAmount)} ·{' '}
                  {tr('Total con IVA', 'Total amb IVA', 'Total including VAT')}
                </span>
                <span className="tabular-nums">{formatEUR(bucket.total)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PricingSlide({ proposal, items }: { proposal: DeckProposal; items: DeckProposalItem[] }) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  const formatEUR = (value: number) => formatPortalEUR(value, language)
  const totals = buildTotals(items, proposal)
  return (
    <SectionSlide
      label={tr('Inversión', 'Inversió', 'Investment')}
      title={tr('Detalle económico', 'Detall econòmic', 'Pricing details')}
    >
      <div className="w-full max-w-3xl">
        <table className="mb-6 w-full text-left text-xs sm:mb-8 sm:text-sm md:text-base">
          <thead>
            <tr className="border-b border-zinc-200">
              <th className="py-2 text-left text-[10px] font-medium tracking-wider text-zinc-500 uppercase sm:py-3 sm:text-xs">
                {tr('Descripción', 'Descripció', 'Description')}
              </th>
              <th className="hidden py-3 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase sm:table-cell">
                {tr('Cant.', 'Quant.', 'Qty.')}
              </th>
              <th className="hidden py-3 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase sm:table-cell">
                {tr('Precio', 'Preu', 'Price')}
              </th>
              <th className="py-2 text-right text-[10px] font-medium tracking-wider text-zinc-500 uppercase sm:py-3 sm:text-xs">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cycle: BillingCycle = item.billing_cycle ?? 'none'
              return (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/50"
                >
                  <td className="py-3 pr-3 text-zinc-800 sm:py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{item.description}</span>
                      <CadenceBadge cycle={cycle} />
                    </div>
                    <span className="mt-0.5 block text-[11px] text-zinc-500 tabular-nums sm:hidden">
                      {item.quantity} × {formatEUR(item.unit_price)}
                    </span>
                  </td>
                  <td className="hidden py-4 text-right text-zinc-500 tabular-nums sm:table-cell">
                    {item.quantity}
                  </td>
                  <td className="hidden py-4 text-right text-zinc-500 tabular-nums sm:table-cell">
                    {formatEUR(item.unit_price)}
                  </td>
                  <td className="py-3 text-right font-medium whitespace-nowrap tabular-nums sm:py-4">
                    {Number(item.discount_percent ?? 0) > 0 ? (
                      <>
                        <span className="block text-xs font-normal text-zinc-400 line-through">
                          {formatEUR(item.subtotal)}
                        </span>
                        {formatEUR(netLineAmount(item))}
                        <span className="block text-[10px] font-normal text-emerald-700">
                          −{Number(item.discount_percent)}%
                          {item.discount_reason ? ` · ${item.discount_reason}` : ''}
                        </span>
                      </>
                    ) : (
                      formatEUR(item.subtotal)
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <PricingTotals totals={totals} globalReason={proposal.discount_reason} />
      </div>
    </SectionSlide>
  )
}

function TeamSlide({ team }: { team: DeckTeamMember[] }) {
  const tr = proposalTr(useContext(LanguageContext))
  return (
    <SectionSlide
      label={tr('El equipo', 'L’equip', 'The team')}
      title={tr(
        'Quién trabajará en tu proyecto',
        'Qui treballarà en el teu projecte',
        'Who will work on your project',
      )}
    >
      <div className="flex max-w-3xl flex-wrap justify-center gap-6 sm:gap-10">
        {team.map((member, i) => (
          <div
            key={member.id}
            className="deck-stagger flex flex-col items-center gap-2 sm:gap-3"
            style={{ ['--i' as string]: 3 + i }}
          >
            <div className="size-16 overflow-hidden rounded-full bg-zinc-200 ring-2 ring-[#2A4227]/10 sm:h-20 sm:w-20">
              {member.avatar_url ? (
                // biome-ignore lint/performance/noImgElement: URL externa de avatar, no compatible con next/image
                <img
                  src={member.avatar_url}
                  alt={member.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#2A4227] text-xl font-bold text-white sm:text-2xl">
                  {member.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-zinc-900 sm:text-sm">{member.name}</p>
              {member.job_title && (
                <p className="mt-0.5 text-[11px] text-zinc-500 sm:text-xs">{member.job_title}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionSlide>
  )
}

function PricingBarChart({
  proposal,
  items,
}: {
  proposal: DeckProposal
  items: DeckProposalItem[]
}) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  const formatEUR = (value: number) => formatPortalEUR(value, language)
  const maxVal = Math.max(...items.map((i) => i.subtotal), 1)
  const totals = buildTotals(items, proposal)
  return (
    <SectionSlide
      label={tr('Inversión', 'Inversió', 'Investment')}
      title={tr('Detalle económico', 'Detall econòmic', 'Pricing details')}
    >
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:gap-5">
          {items.map((item, i) => {
            const cycle: BillingCycle = item.billing_cycle ?? 'none'
            return (
              <div key={item.id} className="deck-stagger" style={{ ['--i' as string]: 3 + i }}>
                <div className="mb-1.5 flex justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-left text-xs text-zinc-700 sm:text-sm">
                      {item.description}
                    </span>
                    <CadenceBadge cycle={cycle} />
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap text-zinc-900 tabular-nums sm:text-sm">
                    {formatEUR(netLineAmount(item))}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 sm:h-2">
                  <div
                    className="h-full rounded-full bg-[#2A4227]"
                    style={{ width: `${(item.subtotal / maxVal) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="border-t border-zinc-200 pt-4">
          <PricingTotals totals={totals} globalReason={proposal.discount_reason} />
        </div>
      </div>
    </SectionSlide>
  )
}

function TermsSlide({ proposal }: { proposal: DeckProposal }) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  return (
    <SectionSlide
      label={tr('Condiciones', 'Condicions', 'Terms')}
      title={tr('Términos del acuerdo', 'Termes de l’acord', 'Agreement terms')}
      accent="zinc"
    >
      <div className="w-full max-w-3xl text-left">
        {proposal.payment_terms ? (
          <div className="mb-6">
            <p className="text-sm font-semibold text-zinc-900">
              {tr('Forma de pago', 'Forma de pagament', 'Payment terms')}
            </p>
            <p className="mt-1 text-xs font-semibold tracking-wider text-[#2A4227] uppercase">
              {publicPaymentScheduleLabel(proposal.payment_schedule, language)}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{proposal.payment_terms}</p>
          </div>
        ) : null}
        {proposal.change_management_terms ? (
          <div className="mb-6">
            <p className="text-sm font-semibold text-zinc-900">
              {tr('Cambios de alcance', 'Canvis d’abast', 'Scope changes')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              {proposal.change_management_terms}
            </p>
          </div>
        ) : null}
        <Markdown
          source={proposal.terms ?? ''}
          className="deck-markdown deck-markdown-terms text-sm text-zinc-600 sm:text-base"
        />
      </div>
    </SectionSlide>
  )
}

function ClosingSlide({ proposal, token }: { proposal: DeckProposal; token: string }) {
  const language = useContext(LanguageContext)
  const tr = proposalTr(language)
  return (
    <div className="deck-slide bg-[#2A4227] p-6 text-center text-white sm:p-10 md:p-16 lg:p-24">
      <Stagger i={0}>
        <LogoMark size={48} variant="brand" className="mb-8 opacity-60 sm:mb-12 sm:size-[56px]" />
      </Stagger>
      <Stagger i={1}>
        <h2 className="mb-4 text-4xl font-bold tracking-tight sm:mb-6 sm:text-5xl md:text-6xl lg:text-7xl">
          {tr('¿Hablamos?', 'En parlem?', 'Shall we talk?')}
        </h2>
      </Stagger>
      <Stagger i={2}>
        <p className="mb-8 max-w-xl px-2 text-base leading-relaxed font-light text-white/60 sm:mb-12 sm:text-lg md:text-xl">
          {tr(
            'Estamos listos para empezar. Cuando confirmes, arrancamos.',
            'Estem preparats per començar. Quan confirmis, ens posem en marxa.',
            'We are ready to start when you confirm.',
          )}
        </p>
      </Stagger>
      <Stagger i={3}>
        <div className="flex flex-col items-center gap-3">
          <a
            href={`/p/proposal/${token}?lang=${language}`}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#2A4227] shadow-lg transition-all hover:gap-4 hover:bg-white/90 sm:gap-3 sm:px-8 sm:py-4 sm:text-base"
          >
            {tr(
              'Ver propuesta y aceptar',
              'Veure i acceptar la proposta',
              'View and accept proposal',
            )}
            <ArrowRight className="size-4 sm:size-5" />
          </a>
          <a
            href={`/p/proposal/${token}/pdf?lang=${language}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/35 px-5 py-2.5 text-xs font-semibold text-white/90 transition-colors hover:border-white hover:bg-white/10"
          >
            <Download className="size-3.5" />
            {tr(
              'Descargar propuesta en PDF',
              'Descarregar la proposta en PDF',
              'Download proposal as PDF',
            )}
          </a>
        </div>
      </Stagger>
      {proposal.client_name && (
        <Stagger i={4}>
          <p className="mt-10 text-[10px] tracking-[0.25em] text-white/40 uppercase sm:mt-16 sm:text-xs sm:tracking-[0.3em]">
            {proposal.client_name}
          </p>
        </Stagger>
      )}
    </div>
  )
}

export function buildSlides(
  proposal: DeckProposal,
  items: DeckProposalItem[],
  token: string,
  team: DeckTeamMember[] = [],
  watermark?: string,
  language: PortalLanguage = 'es',
): DeckSlide[] {
  const tr = proposalTr(language)
  const wm = (el: ReactNode): ReactNode => (
    <LanguageContext.Provider value={language}>
      {watermark ? <SlideWrapper watermark={watermark}>{el}</SlideWrapper> : el}
    </LanguageContext.Provider>
  )

  const slides: DeckSlide[] = []
  slides.push({
    key: 'cover',
    label: tr('Portada', 'Portada', 'Cover'),
    accent: 'green',
    element: wm(<CoverSlide proposal={proposal} />),
  })
  // Narrative (Context → Problems → Solutions) always lands before the
  // price so the client reads the framing first. Each block only renders
  // if it has content, so an empty proposal still flows naturally.
  if (proposal.context_markdown?.trim()) {
    slides.push({
      key: 'context',
      label: tr('Contexto', 'Context', 'Context'),
      accent: 'white',
      element: wm(<ContextSlide proposal={proposal} />),
    })
  }
  if (proposal.problems.length > 0) {
    slides.push({
      key: 'problems',
      label: tr('Retos', 'Reptes', 'Challenges'),
      accent: 'zinc',
      element: wm(
        <KeyPointsListSlide
          label={tr('Retos detectados', 'Reptes detectats', 'Challenges identified')}
          title={tr('Lo que queremos resolver', 'Allò que volem resoldre', 'What we want to solve')}
          items={proposal.problems}
          accent="zinc"
          badgeVariant="muted"
        />,
      ),
    })
  }
  if (proposal.solutions.length > 0) {
    slides.push({
      key: 'solutions',
      label: tr('Solución', 'Solució', 'Solution'),
      accent: 'white',
      element: wm(
        <KeyPointsListSlide
          label={tr('Nuestra propuesta', 'La nostra proposta', 'Our proposal')}
          title={tr('Cómo lo abordamos', 'Com ho abordem', 'How we approach it')}
          items={proposal.solutions}
          accent="white"
          badgeVariant="brand"
        />,
      ),
    })
  }
  proposal.scope_modules.forEach((module, index) => {
    slides.push({
      key: `scope-${module.id}`,
      label: `${tr('Módulo', 'Mòdul', 'Module')} ${index + 1}`,
      accent: 'zinc',
      element: wm(<ScopeModuleSlide module={module} index={index} />),
    })
  })
  const timeline = timelineLayout(proposal.timeline ?? []).map(({ item }) => item)
  for (let offset = 0; offset < timeline.length; offset += 4) {
    slides.push({
      key: `timeline-${offset}`,
      label: tr('Plazos', 'Terminis', 'Timeline'),
      accent: 'zinc',
      element: wm(
        <SectionSlide
          label={tr('El camino', 'El camí', 'The journey')}
          title={tr('Plazos del proyecto', 'Terminis del projecte', 'Project timeline')}
          accent="zinc"
        >
          <div className="max-h-[55vh] w-full max-w-3xl overflow-y-auto print:max-h-none print:overflow-visible">
            <TimelineChart
              items={timeline.slice(offset, offset + 4)}
              allItems={timeline}
              proposalId={proposal.id}
              proposalTitle={proposal.title}
              language={language}
            />
          </div>
        </SectionSlide>,
      ),
    })
  }
  if (proposal.deliverables?.trim() || proposal.acceptance_criteria?.trim()) {
    slides.push({
      key: 'delivery',
      label: tr('Entrega', 'Lliurament', 'Delivery'),
      accent: 'white',
      element: wm(<DeliverySlide proposal={proposal} />),
    })
  }
  if (proposal.development_approach?.trim()) {
    slides.push({
      key: 'development-approach',
      label: tr('Cómo trabajaremos', 'Com treballarem', 'How we will work'),
      accent: 'white',
      element: wm(
        <SectionSlide
          label={tr('Desarrollo', 'Desenvolupament', 'Development')}
          title={tr(
            'Cómo trabajaremos durante el desarrollo',
            'Com treballarem durant el desenvolupament',
            'How we will work during development',
          )}
        >
          <div className="w-full max-w-3xl text-left">
            <Markdown
              source={proposal.development_approach}
              className="deck-markdown text-base text-zinc-700 sm:text-lg"
            />
          </div>
        </SectionSlide>,
      ),
    })
  }
  if (team.length > 0) {
    slides.push({
      key: 'team',
      label: tr('Equipo', 'Equip', 'Team'),
      accent: 'white',
      element: wm(<TeamSlide team={team} />),
    })
  }
  if (items.length > 0) {
    slides.push({
      key: 'services',
      label: tr('Servicios', 'Serveis', 'Services'),
      accent: 'zinc',
      element: wm(<ServicesSlide items={items} />),
    })
    const pricing =
      items.length > 3 ? (
        <PricingBarChart proposal={proposal} items={items} />
      ) : (
        <PricingSlide proposal={proposal} items={items} />
      )
    slides.push({
      key: 'pricing',
      label: tr('Inversión', 'Inversió', 'Investment'),
      accent: 'white',
      element: wm(pricing),
    })
  }
  if (proposal.payment_terms || proposal.change_management_terms || proposal.terms) {
    slides.push({
      key: 'terms',
      label: tr('Condiciones', 'Condicions', 'Terms'),
      accent: 'zinc',
      element: wm(<TermsSlide proposal={proposal} />),
    })
  }
  slides.push({
    key: 'closing',
    label: tr('Cierre', 'Tancament', 'Closing'),
    accent: 'green',
    element: wm(<ClosingSlide proposal={proposal} token={token} />),
  })
  return slides
}
