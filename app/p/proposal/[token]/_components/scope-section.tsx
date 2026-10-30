import { Check, Minus } from 'lucide-react'

import { Markdown } from '@/components/ui/markdown'
import { type parseScopeModules, scopeModuleDurationText } from '@/lib/proposals/scope'

import type { Tr } from '../_lib/i18n'
import { SectionLabel } from './primitives'

type ScopeModule = ReturnType<typeof parseScopeModules>[number]

function ScopeBullets({
  label,
  items,
  tone,
}: {
  label: string
  items: string[]
  tone: 'included' | 'excluded'
}) {
  const included = tone === 'included'
  const Icon = included ? Check : Minus
  return (
    <div
      className={`rounded-lg p-4 ${included ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : 'bg-zinc-50 dark:bg-zinc-900/60'}`}
    >
      <h4
        className={`text-sm font-semibold ${included ? 'text-emerald-800 dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-300'}`}
      >
        {label}
      </h4>
      <ul className="mt-2.5 flex flex-col gap-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Icon
              aria-hidden
              className={`mt-0.5 size-4 shrink-0 ${included ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProposalTextBlock({ label, source }: { label: string; source: string }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{label}</h3>
      <Markdown
        source={source}
        className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
      />
    </section>
  )
}

function ScopeModuleCard({ module, index, tr }: { module: ScopeModule; index: number; tr: Tr }) {
  const duration = scopeModuleDurationText(module)
  return (
    <section
      aria-labelledby={`module-${module.id}`}
      className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40"
    >
      <p className="text-xs font-semibold tracking-wider text-[#2A4227] uppercase dark:text-[#9CC196]">
        {tr('Módulo', 'Mòdul', 'Module')} {String(index + 1).padStart(2, '0')}
      </p>
      <h3
        id={`module-${module.id}`}
        className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
      >
        {module.title}
      </h3>
      {module.description ? (
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          {module.description}
        </p>
      ) : null}
      {duration ? (
        <p className="mt-3 inline-flex rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {tr('Plazo estimado:', 'Termini estimat:', 'Estimated timeline:')} {duration}
        </p>
      ) : null}
      {module.included.length > 0 || module.excluded.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {module.included.length > 0 ? (
            <ScopeBullets
              label={tr('Incluido', 'Inclòs', 'Included')}
              items={module.included}
              tone="included"
            />
          ) : null}
          {module.excluded.length > 0 ? (
            <ScopeBullets
              label={tr('No incluido', 'No inclòs', 'Not included')}
              items={module.excluded}
              tone="excluded"
            />
          ) : null}
        </div>
      ) : null}
      {module.notes ? (
        <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          <strong>{tr('Notas:', 'Notes:', 'Notes:')}</strong> {module.notes}
        </p>
      ) : null}
    </section>
  )
}

export function ScopeSection({
  modules,
  deliverables,
  acceptanceCriteria,
  tr,
}: {
  modules: ScopeModule[]
  deliverables: string
  acceptanceCriteria: string
  tr: Tr
}) {
  if (modules.length === 0 && !deliverables && !acceptanceCriteria) return null
  return (
    <div className="border-b border-zinc-100 px-6 py-7 sm:px-8 dark:border-zinc-800/60">
      <SectionLabel>
        {tr('Alcance del proyecto', 'Abast del projecte', 'Project scope')}
      </SectionLabel>
      <div className="mt-4 flex flex-col gap-4">
        {modules.map((module, index) => (
          <ScopeModuleCard key={module.id} module={module} index={index} tr={tr} />
        ))}
        {deliverables || acceptanceCriteria ? (
          <div
            className={
              deliverables && acceptanceCriteria ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'
            }
          >
            {deliverables ? (
              <ProposalTextBlock
                label={tr('Entregables', 'Lliurables', 'Deliverables')}
                source={deliverables}
              />
            ) : null}
            {acceptanceCriteria ? (
              <ProposalTextBlock
                label={tr(
                  'Criterios de aceptación',
                  'Criteris d’acceptació',
                  'Acceptance criteria',
                )}
                source={acceptanceCriteria}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
