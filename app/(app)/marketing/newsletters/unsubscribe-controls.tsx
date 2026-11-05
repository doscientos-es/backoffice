'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@doscientos/ui'
import { Copy, UserRoundX } from 'lucide-react'
import { useState, useTransition } from 'react'
import { sileo } from 'sileo'

import { Button } from '@/components/ui/button'
import type { EmailMarketingContact } from '@/lib/marketing/email-marketing'

import { unsubscribeMarketingContact } from './actions'

export function CopyUnsubscribeLink({ token, appUrl }: { token: string; appUrl: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(`/api/track/unsubscribe/${token}`, appUrl).href)
      sileo.success({ title: 'Enlace de baja copiado' })
    } catch {
      sileo.error({ title: 'No se pudo copiar el enlace' })
    }
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy}>
      <Copy className="size-4" /> Copiar enlace de baja
    </Button>
  )
}

export function UnsubscribeContactDialog({ contact }: { contact: EmailMarketingContact }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const confirm = () =>
    startTransition(async () => {
      const result = await unsubscribeMarketingContact({ id: contact.id })
      if (!result.ok) return void sileo.error({ title: result.error })
      setOpen(false)
      sileo.success({ title: 'Contacto dado de baja en todas las listas' })
    })
  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserRoundX className="size-4" /> Dar de baja
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Dar de baja a {contact.email}?</DialogTitle>
            <DialogDescription>
              Quedará excluido de los emails comerciales en todas las listas. Importarlo de nuevo no
              reactivará su suscripción.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirm}>
              {pending ? 'Guardando…' : 'Confirmar baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
