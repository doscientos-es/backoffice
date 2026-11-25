'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@doscientos/ui'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createLeadBilling } from '@/app/(app)/clients/actions'
import { type ClientFormDefaults, ClientFormFields } from '@/app/(app)/clients/client-form-fields'
import { Button } from '@/components/ui/button'
import { FormFeedback, useFormFeedback } from '@/components/ui/form-feedback'
import { SubmitButton } from '@/components/ui/submit-button'

export function LeadBillingCreateDialog({
  leadId,
  defaults,
}: {
  leadId: string
  defaults: ClientFormDefaults
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const feedback = useFormFeedback()

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    feedback.setPending()
    const data = new FormData(event.currentTarget)
    data.set('leadId', leadId)
    const result = await createLeadBilling(data)
    if (!result.ok) {
      feedback.setError(result.error)
      return
    }
    feedback.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" aria-hidden />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100%-1rem)] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar datos de facturación</DialogTitle>
          <DialogDescription>Actualiza los datos fiscales.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex max-h-[75svh] flex-col sm:max-h-[70vh]">
          <div className="no-scrollbar flex min-h-0 flex-1 scroll-fade flex-col gap-5 overflow-y-auto pr-1">
            <ClientFormFields
              idPrefix="lead-billing"
              defaults={defaults}
              initiallyExpanded
              includeLogo={false}
            />
          </div>
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end">
            <FormFeedback state={feedback.state} pendingLabel="Guardando…" />
            <SubmitButton loading={feedback.pending} pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
