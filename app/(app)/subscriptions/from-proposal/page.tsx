import type { Metadata } from 'next'
import Link from 'next/link'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePagePermission } from '@/lib/auth'
import { parseMaintenanceOffer, selectedMaintenancePlan } from '@/lib/proposals/maintenance'
import { recurringAmount } from '@/lib/proposals/recurring'
import { SUBSCRIPTION_BILLING_CYCLE, type SubscriptionBillingCycle } from '@/lib/status'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { CreateSubscriptionFromProposalButton } from '../create-subscription-from-proposal-button'

export const metadata: Metadata = { title: 'Crear suscripción desde propuesta · doscientos' }
export const dynamic = 'force-dynamic'

type ProposalRow = {
  id: string
  number: string | null
  title: string
  responded_at: string | null
  maintenance_options: unknown
  maintenance_selected_plan_id: string | null
  clients: { id: string; name: string } | null
  projects: { id: string; name: string } | null
}

export default async function CreateSubscriptionFromProposalPage() {
  await requirePagePermission('finance.write')
  const supabase = await createServerClient()

  const [{ data: proposalData, error }, { data: linkedData }] = await Promise.all([
    supabase
      .from('proposals')
      .select(
        'id, number, title, responded_at, maintenance_options, maintenance_selected_plan_id, clients(id, name), projects(id, name)',
      )
      .eq('status', 'accepted')
      .is('deleted_at', null)
      .order('responded_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('subscriptions')
      .select('proposal_id')
      .not('proposal_id', 'is', null)
      .is('deleted_at', null),
  ])

  const linkedProposalIds = new Set(
    (linkedData ?? [])
      .map((subscription) => subscription.proposal_id as string | null)
      .filter((proposalId): proposalId is string => Boolean(proposalId)),
  )
  const proposals = ((proposalData ?? []) as unknown as ProposalRow[]).flatMap((proposal) => {
    if (linkedProposalIds.has(proposal.id)) return []
    const offer = parseMaintenanceOffer(proposal.maintenance_options)
    const plan = selectedMaintenancePlan(offer, proposal.maintenance_selected_plan_id)
    if (!plan) return []
    return [{ proposal, offer, plan }]
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/subscriptions" label="Suscripciones" />
        <PageHeader
          title="Crear desde propuesta"
          description="Prepara una suscripción de mantenimiento sin empezar a facturarla todavía."
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      {proposals.length === 0 && !error ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No hay propuestas aceptadas con mantenimiento pendientes de convertir.{' '}
            <Link href="/proposals" className="font-medium text-primary hover:underline">
              Ver propuestas
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {proposals.map(({ proposal, offer, plan }) => {
            const cycle = offer.billing_cycle as SubscriptionBillingCycle
            return (
              <Card key={proposal.id}>
                <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {proposal.number ?? 'Sin número'} · Aceptada{' '}
                      {formatDate(proposal.responded_at)}
                    </p>
                    <h2 className="mt-1 truncate font-medium">{proposal.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {proposal.clients?.name ?? 'Sin cliente'}
                      {proposal.projects ? ` · ${proposal.projects.name}` : ''}
                    </p>
                    <p className="mt-2 text-sm">
                      {plan.name} · {formatEUR(recurringAmount(plan.monthly_price, cycle))} /{' '}
                      {SUBSCRIPTION_BILLING_CYCLE[cycle].toLowerCase()}
                    </p>
                  </div>
                  <CreateSubscriptionFromProposalButton proposalId={proposal.id} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
