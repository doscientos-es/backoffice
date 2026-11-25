'use client'

import { useRouter } from 'next/navigation'

import { FormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'
import { useActionForm } from '@/lib/hooks/use-action-form'

import { createSubscription } from '../actions'
import {
  SubscriptionFormFields,
  type SubscriptionLeadOption,
  type SubscriptionProjectOption,
} from '../subscription-form-fields'

export function SubscriptionCreateForm({
  leads,
  projects,
}: {
  leads: SubscriptionLeadOption[]
  projects: SubscriptionProjectOption[]
}) {
  const router = useRouter()
  const { state, pending, onSubmit } = useActionForm(createSubscription, {
    onSuccess: () => router.push('/subscriptions'),
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <SubscriptionFormFields leads={leads} projects={projects} />
      <div className="flex items-center justify-end gap-3">
        <FormFeedback state={state} />
        <SubmitButton loading={pending}>Crear suscripción</SubmitButton>
      </div>
    </form>
  )
}
