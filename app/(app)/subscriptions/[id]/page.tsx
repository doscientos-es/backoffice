import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { DangerZone } from '@/components/ui/danger-zone'
import { StatusBadge } from '@/components/ui/status-badge'
import { SubmitButton } from '@/components/ui/submit-button'
import { requirePagePermission } from '@/lib/auth'
import { computeLineTotals } from '@/lib/finance'
import { can } from '@/lib/permissions'
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/status'
import {
  type BillingCycle,
  buildSubscriptionPeriods,
  type PeriodInvoice,
} from '@/lib/subscriptions/billing-periods'
import { getBillableLeadOptions } from '@/lib/subscriptions/lead-options'
import { createServerClient } from '@/lib/supabase/server'
import { formatDate, formatEUR } from '@/lib/utils'

import { deleteSubscription } from '../actions'
import type { SubscriptionProjectOption } from '../subscription-form-fields'
import { SubscriptionEditForm } from './subscription-edit-form'
import { SubscriptionPeriods } from './subscription-periods'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Suscripción · doscientos' }

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requirePagePermission('finance.read')
  const canEdit = can(user.role, 'finance.write')

  const supabase = await createServerClient()

  const [{ data: sub }, leads, { data: projects }, { data: invoices }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('*, leads(name), clients(name), projects(name)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle(),
    canEdit ? getBillableLeadOptions(supabase) : [],
    supabase.from('projects').select('id, name, lead_id').is('deleted_at', null).order('name'),
    supabase
      .from('invoices')
      .select('id, full_number, subscription_period_start, issue_date, total, status')
      .eq('subscription_id', id)
      .is('deleted_at', null)
      .order('subscription_period_start', {
        ascending: false,
        nullsFirst: false,
      }),
  ])

  if (!sub) notFound()

  const leadId = sub.lead_id as string
  const {
    leads: lead,
    clients: client,
    projects: linkedProject,
  } = sub as unknown as {
    leads: { name: string } | null
    clients: { name: string } | null
    projects: { name: string } | null
  }
  const leadOptions = leads.some((option) => option.id === leadId)
    ? leads
    : [{ id: leadId, name: lead?.name ?? client?.name ?? 'Lead actual' }, ...leads]
  const linkedProjectId = (sub.project_id as string | null) ?? ''
  const projectOptions = (projects ?? []) as SubscriptionProjectOption[]
  const availableProjects =
    linkedProjectId && !projectOptions.some((p) => p.id === linkedProjectId && p.lead_id === leadId)
      ? [
          ...projectOptions,
          {
            id: linkedProjectId,
            lead_id: leadId,
            name: linkedProject?.name ?? 'Proyecto vinculado',
          },
        ]
      : projectOptions

  const today = new Date().toISOString().slice(0, 10)
  const periodRows = buildSubscriptionPeriods({
    startDate: sub.start_date as string,
    endDate: (sub.end_date as string | null) ?? null,
    billingCycle: sub.billing_cycle as BillingCycle,
    nextInvoiceDate: (sub.next_invoice_date as string | null) ?? null,
    status: sub.status as string,
    today,
    invoices: ((invoices ?? []) as unknown as PeriodInvoice[]).map((invoice) => ({
      ...invoice,
      total: Number(invoice.total),
    })),
  })

  const { total: totalWithVat } = computeLineTotals([
    {
      quantity: 1,
      unit_price: Number(sub.amount),
      vat_rate: Number(sub.vat_rate),
    },
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/subscriptions" label="Suscripciones" />
        <PageHeader
          title={sub.name as string}
          description={`${formatEUR(totalWithVat)} IVA incl. · ${formatDate(sub.next_invoice_date as string | null)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusBadge meta={SUBSCRIPTION_STATUS} value={sub.status as SubscriptionStatus} />
            </div>
          }
        />
      </div>

      {canEdit ? (
        <Card>
          <CardContent className="pt-6">
            <SubscriptionEditForm
              id={id}
              version={Number(sub.version)}
              leads={leadOptions}
              projects={availableProjects}
              defaults={{
                lead_id: leadId,
                project_id: linkedProjectId,
                name: sub.name as string,
                description: (sub.description as string | null) ?? '',
                status: sub.status as string,
                billing_cycle: sub.billing_cycle as string,
                amount: Number(sub.amount),
                vat_rate: Number(sub.vat_rate),
                start_date: sub.start_date as string,
                end_date: (sub.end_date as string | null) ?? '',
                notes: (sub.notes as string | null) ?? '',
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <SubscriptionPeriods
        subscriptionId={id}
        rows={periodRows}
        canEdit={canEdit}
        isActive={sub.status === 'active'}
        overdueCount={periodRows.filter((row) => row.state === 'overdue').length}
      />

      {user.role === 'owner' || user.role === 'admin' ? (
        <DangerZone
          title="Eliminar suscripción"
          description="Se eliminará de forma permanente. Esta acción no se puede deshacer."
        >
          <form
            action={async () => {
              'use server'
              await deleteSubscription({ id })
              redirect('/subscriptions')
            }}
          >
            <SubmitButton variant="destructive">Eliminar suscripción</SubmitButton>
          </form>
        </DangerZone>
      ) : null}
    </div>
  )
}
