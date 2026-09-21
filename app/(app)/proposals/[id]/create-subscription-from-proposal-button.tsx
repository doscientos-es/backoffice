'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatEUR } from '@/lib/utils'

import { createSubscriptionFromProposal } from '../actions'

type Props = {
  proposalId: string
  planName: string
  cycleLabel: string
  amount: number
}

export function CreateSubscriptionFromProposalButton({
  proposalId,
  planName,
  cycleLabel,
  amount,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createSubscriptionFromProposal({ id: proposalId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="border-primary/20 bg-primary/5 flex flex-col gap-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Preparar suscripción de mantenimiento</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {planName} · {formatEUR(amount)} / {cycleLabel}. Se creará pausada y no empezará a
          facturar hasta activarla al finalizar el proyecto.
        </p>
      </div>
      <Button type="button" size="sm" onClick={handleCreate} disabled={pending} className="w-fit">
        {pending ? 'Preparando…' : 'Preparar suscripción'}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
