'use client'

import { CheckCircle, RefreshCw, XCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { syncMetaAction } from './actions'

type SyncStatus = 'idle' | 'loading' | 'success' | 'error'

export function SyncMarketingButton() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSync() {
    setStatus('loading')
    setErrorMsg(null)

    let result: Awaited<ReturnType<typeof syncMetaAction>>
    try {
      result = await syncMetaAction(searchParams.get('range') ?? undefined)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Error inesperado')
      return
    }

    if (!result.ok) {
      setStatus('error')
      setErrorMsg(result.error ?? 'Error desconocido')
      return
    }

    setStatus('success')
    router.refresh()
    setTimeout(() => setStatus('idle'), 3000)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        onClick={handleSync}
        disabled={status === 'loading'}
        variant="outline"
        size="sm"
        className={cn(
          status === 'success' && 'border-success/50 text-success',
          status === 'error' && 'border-destructive/50 text-destructive',
        )}
      >
        {status === 'loading' && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
        {status === 'success' && <CheckCircle className="text-success mr-2 h-4 w-4" />}
        {status === 'error' && <XCircle className="text-destructive mr-2 h-4 w-4" />}
        {status === 'idle' && <RefreshCw className="mr-2 h-4 w-4" />}
        {status === 'loading'
          ? 'Sincronizando...'
          : status === 'success'
            ? '¡Sincronizado!'
            : 'Sincronizar Meta Ads'}
      </Button>

      {status === 'error' && errorMsg && (
        <p className="text-destructive max-w-xs text-right text-xs">{errorMsg}</p>
      )}
    </div>
  )
}
