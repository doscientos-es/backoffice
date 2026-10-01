'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { createSubscriptionFromProposal } from '../proposals/actions'

type Props = {
  proposalId: string
}

export function CreateSubscriptionFromProposalButton({ proposalId }: Props) {
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
    <div className="flex flex-col items-end gap-2">
      <Button type="button" size="sm" onClick={handleCreate} disabled={pending}>
        {pending ? 'Creando…' : 'Crear suscripción pausada'}
      </Button>
      {error ? (
        <Alert variant="destructive" className="max-w-xs text-left">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
