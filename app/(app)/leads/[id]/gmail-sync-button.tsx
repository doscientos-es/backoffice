'use client'

import { LoaderCircle as Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { sileo } from 'sileo'

import { GmailIcon } from '@/components/icons/gmail-icon'
import { Button } from '@/components/ui/button'

import { syncLeadGmail } from '../actions'

export function GmailSyncButton({
  leadId,
  leadEmail,
}: {
  leadId: string
  leadEmail: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function onClick() {
    startTransition(async () => {
      const result = await syncLeadGmail({ leadId })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }
      const suffix = result.unavailableMailboxes.length
        ? ` · ${result.unavailableMailboxes.length} buzón(es) no disponible(s)`
        : ''
      sileo.success({ title: `${result.imported} emails añadidos al historial${suffix}` })
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 w-full min-w-0 justify-start gap-2 px-2.5 text-left text-xs"
      disabled={pending || !leadEmail}
      aria-label={pending ? 'Sincronizando Gmail' : 'Sincronizar Gmail'}
      title={leadEmail ? 'Importar emails de Gmail' : 'Este lead no tiene email registrado'}
      onClick={onClick}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <GmailIcon />}
      {pending ? 'Sincronizando…' : 'Sincronizar'}
    </Button>
  )
}
