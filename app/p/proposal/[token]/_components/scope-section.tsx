import { Check, Minus } from 'lucide-react'

import { Markdown } from '@/components/ui/markdown'
import { type parseScopeModules, scopeModuleDurationText } from '@/lib/proposals/scope'

import type { Tr } from '../_lib/i18n'
import { PROPOSAL_SURFACE_CLASS, SectionLabel } from './primitives'

type ScopeModule = ReturnType<typeof parseScopeModules>[number]

export function DevelopmentApproachSection({ source, tr }: { source?: string | null; tr: Tr }) {
  const content = source?.trim()
  if (!content) return null
  return (
    <section
      id="desarrollo"
      className={`${PROPOSAL_SURFACE_CLASS} scroll-mt-16 px-6 py-10 sm:px-10`}
    >
      <SectionLabel className="text-center">
        {tr(
          'Cómo trabajaremos durante el desarrollo',
          'Com treballarem durant el desenvolupament',
          'How we will work during development',
        )}
      </SectionLabel>
      <Markdown
        source={content}
        className="mt-6 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
      />
    </section>
  )
}

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
    <div>
      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</h4>
      <ul className="mt-2.5 flex flex-col gap-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5">
            <Icon
              aria-hidden
              className={`mt-0.5 size-4 shrink-0 rounded-full ${included ? 'bg-[#BDFF7B] p-0.5 text-zinc-950' : 'text-zinc-500'}`}
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
    <section>
      <Markdown
        source={source}
        className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
        fallbackHeading={
          <h3 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{label}</h3>
        }
      />
    </section>
  )
}

function ScopeModuleCard({ module, tr }: { module: ScopeModule; tr: Tr }) {
  const duration = scopeModuleDurationText(module)
  return (
    <section aria-labelledby={`module-${module.id}`} className="py-4">
      <h3
        id={`module-${module.id}`}
        className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
      >
        {module.title}
      </h3>
      {module.description ? (
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          {module.description}
        </p>
      ) : null}
      {duration ? (
        <p className="mt-3 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          {tr('Plazo estimado:', 'Termini estimat:', 'Estimated timeline:')} {duration}
        </p>
      ) : null}
      {module.included.length > 0 || module.excluded.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
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
        <p className="mt-4 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
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
    <div className={`${PROPOSAL_SURFACE_CLASS} px-6 py-10 sm:px-10`}>
      <SectionLabel className="text-center">
        {tr('Alcance del proyecto', 'Abast del projecte', 'Project scope')}
      </SectionLabel>
      <div className="mt-6 flex flex-col gap-8">
        {modules.map((module) => (
          <ScopeModuleCard key={module.id} module={module} tr={tr} />
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
