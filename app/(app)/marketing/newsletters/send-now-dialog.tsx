'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { Send } from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'

import { sendEmailMarketingStepNow } from './actions'

export function SendNowDialog({
  id,
  title,
  listName,
  count,
  active,
  configured,
}: {
  id: string
  title: string
  listName: string
  count: number
  active: boolean
  configured: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  function send() {
    startTransition(async () => {
      const result = await sendEmailMarketingStepNow({ id, confirm: true })
      if (!result.ok) return void sileo.error({ title: result.error })
      setOpen(false)
      if (result.outcome === 'attention')
        sileo.error({
          title: 'Hay envíos que necesitan revisión',
          description: 'Consulta la actividad y los errores de este email.',
        })
      else if (result.outcome === 'queued')
        sileo.error({
          title: 'El email ha quedado en cola',
          description: 'Revisa la actividad antes de volver a intentarlo.',
        })
      else
        sileo.success({
          title: 'Envío iniciado',
          description: 'Los destinatarios pendientes se procesarán en lotes.',
        })
    })
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!active || !configured || count === 0}
        onClick={() => setOpen(true)}
      >
        <Send className="size-4" /> Enviar ahora
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Enviar «{title}» ahora?</DialogTitle>
            <DialogDescription>
              Se iniciará el envío a los contactos suscritos de {listName} (actualmente {count}). Se
              respetarán las bajas y no se enviarán otros correos de la secuencia. Los envíos se
              procesan en lotes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={send}>
              {pending ? 'Iniciando…' : 'Confirmar envío'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
