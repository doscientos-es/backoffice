import { Mail } from 'lucide-react'

import type { Tr } from '../_lib/i18n'
import type { ProposalTeamMember } from '../_lib/types'
import { PROPOSAL_SURFACE_CLASS, SectionLabel } from './primitives'

export function TeamSection({ team, tr }: { team: ProposalTeamMember[]; tr: Tr }) {
  if (team.length === 0) return null

  return (
    <section id="equipo" className={`${PROPOSAL_SURFACE_CLASS} scroll-mt-20 px-6 py-8 sm:px-8`}>
      <SectionLabel>{tr('El equipo', 'L’equip', 'The team')}</SectionLabel>
      <p className="mt-2 text-sm text-zinc-600">
        {tr(
          'Las personas que trabajarán en tu proyecto.',
          'Les persones que treballaran en el teu projecte.',
          'The people who will work on your project.',
        )}
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {team.map((member) => {
          const content = (
            <>
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#BDFF7B] text-xl font-semibold text-zinc-950">
                {member.avatar_url ? (
                  // biome-ignore lint/performance/noImgElement: external team avatar URL
                  <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>{member.name.trim().charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-zinc-950">{member.name}</span>
                {member.job_title ? (
                  <span className="mt-0.5 block text-sm text-zinc-600">{member.job_title}</span>
                ) : null}
                {member.contactEmail ? (
                  <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-zinc-700 underline underline-offset-2">
                    <Mail aria-hidden className="size-3.5" />
                    {tr('Enviar email', 'Enviar correu', 'Send email')}
                  </span>
                ) : null}
              </span>
            </>
          )
          const cardClass = 'flex h-full items-center gap-4 rounded-2xl bg-zinc-50 p-4'
          return (
            <li key={member.id}>
              {member.contactEmail ? (
                <a
                  href={`mailto:${encodeURIComponent(member.contactEmail).replace('%40', '@')}`}
                  aria-label={tr(
                    `Enviar email a ${member.name}`,
                    `Enviar correu a ${member.name}`,
                    `Email ${member.name}`,
                  )}
                  className={`${cardClass} transition-colors hover:bg-[#edffdf] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950`}
                >
                  {content}
                </a>
              ) : (
                <div className={cardClass}>{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
