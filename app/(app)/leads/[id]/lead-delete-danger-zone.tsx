'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DangerZone } from '@/components/ui/danger-zone'

import { deleteLead } from '../actions'

export function LeadDeleteDangerZone({ leadId, leadName }: { leadId: string; leadName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteLead({ id: leadId })
      if (!result.ok) {
        sileo.error({ title: result.error })
        return
      }

      setOpen(false)
      sileo.success({ title: 'Lead eliminado' })
      router.replace('/leads')
    })
  }

  return (
    <>
      <DangerZone description="El lead se marcará como eliminado y dejará de aparecer en las vistas de leads.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            El borrado no elimina físicamente los datos, pero no se puede deshacer desde esta
            interfaz.
          </p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() => setOpen(true)}
          >
            Eliminar lead
          </Button>
        </div>
      </DangerZone>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`¿Eliminar a ${leadName}?`}
        description="El lead desaparecerá del pipeline. Esta acción no se puede deshacer desde la interfaz."
        confirmLabel={pending ? 'Eliminando…' : 'Sí, eliminar lead'}
        destructive
        pending={pending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
