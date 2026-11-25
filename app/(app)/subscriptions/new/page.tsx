import type { Metadata } from 'next'

import { BackLink } from '@/components/layout/back-link'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { requirePagePermission } from '@/lib/auth'
import { getBillableLeadOptions } from '@/lib/subscriptions/lead-options'
import { createServerClient } from '@/lib/supabase/server'

import type { SubscriptionProjectOption } from '../subscription-form-fields'
import { SubscriptionCreateForm } from './subscription-create-form'

export const metadata: Metadata = { title: 'Nueva suscripción · doscientos' }

export default async function NewSubscriptionPage() {
  await requirePagePermission('finance.write')

  const supabase = await createServerClient()
  const [leads, { data: projects }] = await Promise.all([
    getBillableLeadOptions(supabase),
    supabase.from('projects').select('id, name, lead_id').is('deleted_at', null).order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/subscriptions" label="Suscripciones" />
        <PageHeader
          title="Nueva suscripción"
          description="Define un servicio recurrente para un lead con datos de facturación."
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <SubscriptionCreateForm
            leads={leads}
            projects={(projects ?? []) as SubscriptionProjectOption[]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
