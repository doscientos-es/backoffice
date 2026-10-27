'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import { voidNda } from './actions'

export function VoidNdaButton({ id, leadId }: { id: string; leadId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!window.confirm('¿Anular este NDA? El enlace público dejará de funcionar.')) return
    setPending(true)
    setError(null)
    const result = await voidNda({ id, leadId })
    if (result.ok) router.refresh()
    else setError(result.error)
    setPending(false)
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={run} disabled={pending}>
        Anular
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </>
  )
}
