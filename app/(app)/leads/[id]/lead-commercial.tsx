import { BriefcaseBusiness, FileText, ReceiptText } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { LeadRelatedInvoice, LeadRelatedProject, LeadRelatedProposal } from '@/lib/leads/types'
import {
  INVOICE_STATUS,
  type InvoiceStatus,
  PROPOSAL_STATUS,
  PROJECT_STATUS,
  type ProjectStatus,
} from '@/lib/status'
import { formatEUR } from '@/lib/utils'

type LeadCommercialProps = {
  leadId: string
  linkedClientId: string | null
  proposals: LeadRelatedProposal[]
  canSeeProposalPrices: boolean
  projects: LeadRelatedProject[]
  invoices: LeadRelatedInvoice[]
}

/** Shown in place of a list when projects/invoices require a client. */
function ClientRequiredHint() {
  return (
    <p className="px-6 py-2 text-sm text-muted-foreground">
      Disponible cuando el lead sea cliente.
    </p>
  )
}

function relationshipSummary(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function proposalFollowUpHint(proposal: LeadRelatedProposal): string | null {
  if (proposal.status !== 'sent' && proposal.status !== 'viewed') return null
  if (proposal.valid_until && new Date(`${proposal.valid_until}T23:59:59`) < new Date()) {
    return 'Vigencia vencida · confirmar si sigue interesado'
  }
  if (!proposal.sent_at) return 'Enviada · confirmar recepción'
  const elapsedHours = (Date.now() - new Date(proposal.sent_at).getTime()) / 3_600_000
  if (elapsedHours >= 72) {
    const elapsedDays = Math.floor(elapsedHours / 24)
    return `Enviada hace ${elapsedDays} ${elapsedDays === 1 ? 'día' : 'días'} · confirmar respuesta`
  }
  if (proposal.viewed_at) return 'Vista · resolver dudas y acordar siguiente paso'
  return null
}

function MobileRelationshipRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="flex min-w-0 flex-col gap-1.5">{children}</dd>
    </div>
  )
}

function MobileEmptyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-primary hover:underline">
      {children}
    </Link>
  )
}

/**
 * Commercial pipeline shortcuts for a lead: proposals (lead-first, no NIF
 * required), plus projects and invoices that only exist once the lead is
 * converted into a client.
 */
export function LeadCommercial({
  leadId,
  linkedClientId,
  proposals,
  canSeeProposalPrices,
  projects,
  invoices,
}: LeadCommercialProps) {
  return (
    <section aria-label="Relaciones comerciales">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relaciones comerciales</CardTitle>
          <p className="mt-1 text-sm font-normal text-muted-foreground">
            {[
              relationshipSummary(proposals.length, 'propuesta', 'propuestas'),
              relationshipSummary(projects.length, 'proyecto', 'proyectos'),
              relationshipSummary(invoices.length, 'factura', 'facturas'),
            ].join(' · ')}
          </p>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-4">
            <MobileRelationshipRow icon={<FileText className="size-3.5" />} label="Propuestas">
              {proposals.length === 0 ? (
                <MobileEmptyLink href={`/proposals/new?lead_id=${leadId}`}>
                  Crear propuesta
                </MobileEmptyLink>
              ) : (
                proposals.map((proposal) => (
                  <Link
                    key={proposal.id}
                    href={`/proposals/${proposal.id}`}
                    className="flex min-w-0 flex-col gap-1 rounded-md px-1 py-1.5 text-xs transition-colors hover:bg-muted"
                  >
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {proposal.number ?? proposal.title ?? 'Propuesta'}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {proposal.status ? (
                          <StatusBadge meta={PROPOSAL_STATUS} value={proposal.status} />
                        ) : null}
                        {canSeeProposalPrices && proposal.total != null ? (
                          <span className="text-muted-foreground tabular-nums">
                            {formatEUR(proposal.total)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    {proposalFollowUpHint(proposal) ? (
                      <span className="text-[11px] leading-snug text-warning">
                        {proposalFollowUpHint(proposal)}
                      </span>
                    ) : null}
                  </Link>
                ))
              )}
            </MobileRelationshipRow>

            <MobileRelationshipRow
              icon={<BriefcaseBusiness className="size-3.5" />}
              label="Proyectos"
            >
              {!linkedClientId ? (
                <span className="text-xs text-muted-foreground">Cuando sea cliente</span>
              ) : projects.length === 0 ? (
                <MobileEmptyLink href={`/projects/new?client_id=${linkedClientId}`}>
                  Crear proyecto
                </MobileEmptyLink>
              ) : (
                projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-muted"
                  >
                    <span className="truncate font-medium">{project.name}</span>
                    <StatusBadge meta={PROJECT_STATUS} value={project.status as ProjectStatus} />
                  </Link>
                ))
              )}
            </MobileRelationshipRow>

            <MobileRelationshipRow icon={<ReceiptText className="size-3.5" />} label="Facturas">
              {!linkedClientId ? (
                <span className="text-xs text-muted-foreground">Cuando sea cliente</span>
              ) : invoices.length === 0 ? (
                <span className="text-xs text-muted-foreground">Sin facturas</span>
              ) : (
                invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-muted"
                  >
                    <span className="truncate font-medium">{invoice.full_number ?? 'Factura'}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge meta={INVOICE_STATUS} value={invoice.status as InvoiceStatus} />
                      <span className="text-muted-foreground tabular-nums">
                        {formatEUR(Number(invoice.total ?? 0))}
                      </span>
                    </span>
                  </Link>
                ))
              )}
            </MobileRelationshipRow>
          </dl>
        </CardContent>
      </Card>
    </section>
  )
}
